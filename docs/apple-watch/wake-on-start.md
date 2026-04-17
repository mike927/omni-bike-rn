# Apple Watch Wake-On-Start From iPhone

Goal: when the user starts a ride on iPhone, the Omni Bike Watch companion app should auto-foreground and begin streaming HR, even when the Watch app is suspended or the wrist is down. This is how AllTrails, Strava, and Apple Fitness behave.

Status: **not working end-to-end as of 2026-04-17.** Canonical WWDC23 flow is implemented and deployed on hardware, but the Watch never wakes. Best current hypothesis is that free-developer-account sideload installs bypass the HealthKit wake broker. Workaround in place: the user opens the Watch app manually before training.

Sources:
  - https://developer.apple.com/videos/play/wwdc2023/10023 (WWDC23 "Build a multi-device workout app")
  - https://developer.apple.com/documentation/healthkit/hkhealthstore/startwatchapp(with:completion:)
  - https://developer.apple.com/documentation/healthkit/hkhealthstore/workoutsessionmirroringstarthandler
  - https://developer.apple.com/documentation/watchkit/wkapplicationdelegate/handle(_:)-61yuw

Verified: 2026-04-17 against iOS 18 SDK, paired Apple Watch, free Apple developer account, `xcrun devicectl` install path.

## Canonical Flow (What Apple Ships)

Per WWDC23 session 10023:

1. **iPhone** calls `HKHealthStore.startWatchApp(with: HKWorkoutConfiguration, completion:)`. This delegates to a HealthKit system daemon that decides whether to wake the paired Watch app.
2. **iPhone** registers `healthStore.workoutSessionMirroringStartHandler` early in app launch so HealthKit can hand back the mirrored session once the Watch creates it.
3. **Watch** (on wake) receives the `HKWorkoutConfiguration` via `WKApplicationDelegate.handle(_ workoutConfiguration: HKWorkoutConfiguration)`.
4. **Watch** creates an `HKWorkoutSession`, calls `session.startActivity(...)`, and calls `session.startMirroringToCompanionDevice(completion:)` — this is the mirror leg that makes the iPhone's `workoutSessionMirroringStartHandler` fire.
5. **iPhone** receives the mirrored session and can observe live HR via the mirrored builder, or receive samples via `WCSession.sendMessage(_:replyHandler:)`.

In this architecture the **Watch is the primary session owner**. The iPhone is the companion. `startMirroringToCompanionDevice(completion:)` is `API_UNAVAILABLE(ios)` — an iPhone cannot initiate mirroring to a Watch, which rules out any "iPhone-primary" variant.

## What Is Implemented

Code lives on branch `feat/apple-watch-hr`.

- `modules/watch-connectivity/ios/WatchConnectivityModule.swift`
  - `OnCreate` registers `healthStore.workoutSessionMirroringStartHandler`
  - `startWatchApp()` exposes `HKHealthStore.startWatchApp(with:)` to JS
  - After `startWatchApp` success, flushes a WC `start` command over `sendMessage` when the Watch becomes reachable
  - `endMirroredWorkout()` sends `stop` via `sendMessage` if reachable, else queues via `transferUserInfo` for FIFO delivery
- `ios/OmniBikeWatch Watch App/WorkoutManager.swift`
  - `WKApplicationDelegate.handle(_:)` forwards the configuration to `requestAuthorization(starting:)`
  - `startWorkout` creates the session, starts activity, begins collection, and calls `startMirroringToCompanionDevice`
  - `didReceiveMessage` / `didReceiveUserInfo` both route through `handleCommand` — so queued stops are processed in the background
  - `recoverOrphanedSession` runs on `WorkoutManager` init and ends any session that watchOS restored from a prior kill
- `ios/omnibikern/Info.plist` sets `LSApplicationCategoryType = public.app-category.healthcare-fitness` (hypothesized hint to the HealthKit wake broker)
- `app.config.ts` propagates the above to prebuild

## What Works

- Foreground flow: user opens Watch app manually, grants HealthKit, starts ride from iPhone → Watch starts session, streams HR at 1 Hz, session ends cleanly.
- `transferUserInfo`-queued stop delivery: confirmed working via FIFO once Watch becomes reachable.
- `recoverActiveWorkoutSession`: correctly ends sessions that watchOS auto-restores after the Watch app is killed with an active workout.

## What Fails

Observed on a real iPhone + Apple Watch pair via sideload install:

1. iPhone log shows `HKHealthStore.startWatchApp(with:)` returns `success=true`.
2. `WCSession.isReachable` stays `false`.
3. `sessionReachabilityDidChange` never fires.
4. `workoutSessionMirroringStartHandler` never fires.
5. No log line on the Watch side — the app process is never started by the system.

Representative log (`/tmp/omni-bike-logs/iphone.wc.log`):

```
[19:18:36.184] [WC-iPhone] startWatchApp: WC state=2 paired=true installed=true reachable=false
[19:18:36.408] [WC-iPhone] startWatchApp: SUCCESS — scheduling start cmd
[19:18:36.409] [WC-iPhone] flushPendingStart: not reachable yet (reachable=false) — will retry on reachability change
[19:18:48.520] [WC-iPhone] endMirroredWorkout: dropping — activated=true reachable=false
```

## Ruled Out

- **Wrong flow direction.** Initial "Option B" attempt ran an iPhone-primary session and tried to mirror *to* the Watch. `startMirroringToCompanionDevice(completion:)` is `API_UNAVAILABLE(ios)` in the HealthKit headers, confirming the Watch-primary model is the only supported architecture. Abandoned.
- **`LSApplicationCategoryType` alone.** Added `public.app-category.healthcare-fitness` in Info.plist and re-tested — no change in behavior.
- **HKHealthStore re-instantiation timing.** The `HKHealthStore` that registers the mirroring handler is the same instance that calls `startWatchApp`. Handler registration happens in `OnCreate` before any `startWatchApp` call.
- **WC not activated on iPhone.** Logs confirm `WCSession.default.activationState == 2` (activated) at the time of `startWatchApp`.

## Open Hypotheses (Ranked)

1. **Sideload install path.** The Watch app was installed via `xcrun devicectl device install app ...` directly to the Watch, rather than via the iPhone Watch companion app syncing the watchOS extension from a paired iPhone install. HealthKit's wake broker may only trust Watch apps that were registered through the companion-sync path. This is the leading suspect because AllTrails and Strava both ship through TestFlight or the App Store — both of which install via companion sync.
2. **HealthKit authorization never granted on the Watch.** `HKHealthStore.requestAuthorization(...)` on the Watch has never run, because the Watch app has never been launched. If the wake broker requires prior HK authorization grant to target the companion, `startWatchApp` would succeed from iPhone's perspective but silently no-op. This was tested by opening the Watch app manually to grant HK perms, then backgrounding it and retrying — outcome inconclusive (other variables changed between tests).
3. **watchOS rate-limiting or developer-build throttling.** Sideloaded Watch apps on a free developer account may have stricter background execution limits. Not documented, observed only indirectly.
4. **Missing entitlements or Info.plist keys specific to Watch wake.** We set `LSApplicationCategoryType` but there may be additional plist keys or entitlements (e.g., `WKBackgroundModes`, `NSHealthClinicalHealthRecordsShareUsageDescription` variants, or an explicit mirroring capability) that production apps ship with. Not verified.

## Next Experiments To Try

When this work is picked up again:

- [ ] **Distribute via TestFlight** (requires paid Apple developer account). If TestFlight install fixes wake behavior, hypothesis #1 is confirmed.
- [ ] **Pre-grant HK authorization on Watch.** Automate a one-time Watch app foreground + auth grant during onboarding. Measure whether `startWatchApp` begins to wake the Watch afterwards.
- [ ] **Compare entitlements with a known-working reference app.** Download AllTrails IPA (via TestFlight redemption on the test device), extract entitlements + Info.plist for the Watch extension, diff against ours.
- [ ] **Check `workoutSessionMirroringStartHandler` under a different session lifecycle.** Current handler is registered in `OnCreate`. Try registering it inside `application(_:didFinishLaunchingWithOptions:)` on the iPhone AppDelegate instead, in case HealthKit keys off UIKit lifecycle.
- [ ] **Confirm Watch-side `WKApplicationDelegate.handle(_:)` wiring.** Add a log that fires on `application(_:didFinishLaunchingWithOptions:)` of the Watch app to prove whether the process is being launched at all during `startWatchApp`.

## Relevant Files

- `modules/watch-connectivity/ios/WatchConnectivityModule.swift`
- `ios/OmniBikeWatch Watch App/WorkoutManager.swift`
- `ios/OmniBikeWatch Watch App/WatchAppDelegate.swift`
- `ios/OmniBikeWatch Watch App/ContentView.swift`
- `ios/omnibikern/Info.plist`
- `app.config.ts`
- `src/services/watch/WatchHrAdapter.ts`
- `src/features/gear/hooks/useWatchHr.ts`
- `modules/watch-connectivity/src/index.ts`

## Memory Pointer

See user memory `project_watch_install_workaround.md` for the free-account install workaround (direct `devicectl` push to Watch instead of iPhone companion sync). That workaround is itself the leading suspect for why wake-on-start is broken.
