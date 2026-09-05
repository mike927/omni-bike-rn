# Consolidated device verification pass, audit 2026-09-05 · ⏱ ~80 min

[Audit index](README.md) · Build under test: `main` at `c19673e` · Produced by the repository `manual-test-handoff` skill

One device pass that settles [A11](issues/A11-native-upgrade-verification.md) and the device-only
residual of every ticket remediated in this run (A01 to A10). Each of those tickets links here, so
running this once closes all of them at the same revision instead of ten separate device cycles.

## What we are verifying

That Expo 57 / React Native 0.86.3 plus the ten audit fixes behave on real hardware: BLE drop and
recover on both the bike and the strap, one ride clock across navigation, manual pause precedence,
the Watch lifecycle under out-of-order commands, the Apple Health save of a paused ride, and the
recovery of an upload killed mid-flight. Jest substitutes the BLE transport, WatchConnectivity,
HealthKit and SQLite, so none of this is proven today.

## What is already verified, and how

Do not re-run these. They are settled, and knowing that keeps the device pass short.

| Area | Already proven | By what |
| --- | --- | --- |
| Ride clock ownership (A01) | One tick per second with two consumers mounted, across Back and re-entry | Jest against the real `MetronomeEngine` on fake timers |
| Manual pause precedence (A06) | A manual pause survives a bike `Started` event, screen and wrist | Jest against the real `sessionController` |
| Durable save (A02) | Draft, sample and finalization failures each surface, and a failed finish never navigates | Jest with injected repository errors |
| Power calorie tier (A04) | An energy-only FTMS packet keeps the bike tier; a real 0 W bike keeps the power tier | Real FTMS parser plus the real engine, mocked BLE transport |
| BLE observers (A05) | Registration, adapter identity guard, disposal before every deliberate teardown | Jest with a fixture whose `remove()` really deregisters |
| Upload recovery (A03) | `uploading` at boot becomes `interrupted`; no second `exportSession` runs | Jest state machine plus the boot sweep |
| TCX distance (A07) | Workout-relative trackpoints, legacy reconstruction capped at the stored total; migration `0002_damp_ink` applied to a real populated SQLite file offline | Jest plus an offline migration replay |
| Pause history (A08) | The payload carries the pause and resume events; an unknown history is never rewritten | Jest, plus `swiftc -parse` on the native module |
| Watch intent (A09) | 19 host-run lifecycle checks, 20 mutations all red | `npm run test:watch-lifecycle` on the extracted decision model |
| Reconnect ownership (A10) | One global budget and cadence however many screens are mounted | Jest against the root-owned controller |
| Gate | Lint, typecheck and the full Jest suite | `npm run ci:gate`, green on every merged ticket |

What none of that reaches: whether `ble-plx` really raises `onDeviceDisconnected` for a peripheral
that loses power, whether `Subscription.remove()` really deregisters natively (every Jest proof
assumes it by fixture, and a probe against a no-op `remove()` reproduces the original A05 defect even
on shipped code), whether HealthKit actually applies the workout events, whether the Watch reconciles
correctly when the two WatchConnectivity transports deliver out of order, and whether the app's own
migration runner applies `0002` and `0003` to a real user database on device.

## Preconditions

Read top to bottom. **If any `Confirm` cannot be met, stop and fix that row first.** A half set up run
wastes the whole cycle.

| Do? | Action | Where | Confirm |
| --- | --- | --- | --- |
| ✅ | **Rebuild the Watch app as a matched pair** | Xcode, `omnibikern` scheme, run to the iPhone with the Watch paired | Both apps launch. This is mandatory: A09 added `sentAtMs` to the iPhone to Watch wire format, so a mismatched pair tests nothing (`npm run ios` installs the phone app only and cannot push the Watch app) |
| ❌ | Rebuild the iPhone app | Xcode | skip, included in the matched pair build above (A08 changed `AppleHealthWorkoutModule.swift` and A09 changed `WatchConnectivityModule.swift`, so a native iPhone rebuild is required and the matched pair covers it) |
| ❌ | Reload Metro (JS) | iTerm, press `r` | skip, included in the rebuild above |
| ✅ | Unlock the iPhone and the Watch, keep the iPhone tethered to the Mac | physical devices | Accept the trust prompt if it appears; the tether is only so logs can be pulled afterwards |
| ✅ | Trust the developer profile if iOS asks | iPhone, **iOS Settings** app, General, VPN and Device Management | Omni Bike launches instead of showing a security message |
| ✅ | Confirm the Watch companion is seen | mobile app, **Home tab** | The Watch surface does not read "Unavailable" (if it does, reinstall the matched pair from Xcode, do not continue) |
| ✅ | Have both a saved bike and a saved Bluetooth HR sensor | mobile app, **Settings tab**, My Gear | Both are listed. Block B needs the Bluetooth strap; blocks D and E need the Watch |
| ✅ | Wear the strap, wake the bike, wear the Watch | physical devices | The bike is powered and out of standby |
| ✅ | Apple Health connected with permission to write workouts | mobile app, **Settings tab**, Integrations | Reads connected. If not, connect it before starting |
| ✅ | Leave the bike's own odometer alone | 🤚 the bike's console | Do **not** reset its lifetime distance. Block G depends on it being non-zero |
| ✅ | Do not delete any existing ride | mobile app, **History tab** | Step 2 needs the pre-upgrade rides intact |
| ✅ | Set aside about 80 minutes and have somewhere to pedal | 🤚 physical | Blocks B to G each need real pedalling |

## Steps

Blocks run in order. Each block is self-contained, so you can stop between blocks and resume later,
but do not reorder within a block.

### Block A, install and first launch · ~10 min

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 1 | 📱 mobile app | Launch Omni Bike for the first time on the new build | Home opens, no error screen and no "Opening Omni Bike" that never finishes |
| 2 | 📱 mobile app | Open the **History tab** | Every ride recorded before this build is still listed, with the same date, duration and distance |
| 3 | 📱 mobile app | Open the oldest ride in the list | Its summary opens with its numbers intact |
| 4 | ⌚ watch app | Open Omni Bike on the wrist | It opens and stays open |
| 5 | 📱 mobile app | **Only if the Watch has never been granted Health access on this install.** Start a ride from **Home** | The Watch shows the HealthKit permission prompt |
| 6 | ⌚ watch app | Leave that prompt **unanswered** | The prompt stays on screen |
| 7 | 📱 mobile app | Press Finish on the phone while the prompt is still open, and discard the ride | The ride ends on the phone |
| 8 | ⌚ watch app | Only now answer the prompt with Allow | The Watch returns to its idle screen and does **not** start a workout |

If the prompt never appeared at step 5, skip steps 6 to 8 and say so; that check is only reproducible
before Health has been authorized on the Watch.

### Block B, BLE drop and recover · ~15 min

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 9 | 📱 mobile app | **Settings tab**, set the heart rate source to the Bluetooth sensor | The strap is selected instead of Apple Watch |
| 10 | 📱 mobile app | **Home tab**, connect the bike and the strap | Both device cards read Ready |
| 11 | 📱 mobile app | Start a ride and pedal for about a minute | Live power and cadence, and live heart rate from the strap |
| 12 | 🤚 physical | Power the strap off, then power it back on within about 5 seconds | The strap card leaves Ready, then returns to Ready on its own, without you touching the phone. Heart rate comes back |
| 13 | 🤚 physical | Power the strap off again and leave it off for a full minute | The strap card tries for a few seconds, then stops trying and settles. It must **not** spin forever |
| 14 | 🤚 physical | Power the strap back on | Nothing happens on the phone by itself, which is correct: the retry budget is spent |
| 15 | 📱 mobile app | Press Retry on the strap card | It dials again and returns to Ready, heart rate resumes |
| 16 | 🤚 physical | With the ride still running, switch the bike off at the wall | The ride freezes within a second or two: the elapsed clock stops and the bike card leaves Ready |
| 17 | 🤚 physical | Power the bike back on and wake it | The bike card returns to Ready, or does after one Retry |
| 18 | 📱 mobile app | Resume the ride and pedal for 30 seconds | The clock runs again at one second per second |
| 19 | 📱 mobile app | Press Finish, then Save | The summary opens, then the ride lands in History |
| 20 | 📱 mobile app | **Settings tab**, watch both device cards for a full minute without touching anything | Neither device reconnects by itself. Both stay disconnected |

Step 20 is the single most load-bearing observation in this pass. It is the only evidence that the
native disconnect observers are really released; no Jest run can prove it.

### Block C, one ride clock, navigation and manual pause · ~10 min

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 21 | 📱 mobile app | **Home tab**, start a ride and pedal 20 seconds | The ride screen opens and the clock runs |
| 22 | 📱 mobile app | Press Back to Home, keep pedalling for 30 seconds | Home shows a ride in progress |
| 23 | 📱 mobile app | Reopen the ride screen | Elapsed has advanced by about 30 seconds. Not by 60, and not reset to 0 |
| 24 | 📱 mobile app | Press Pause, then keep pedalling for 30 seconds | The ride stays Paused and elapsed does not move, even though the bike is reporting |
| 25 | 📱 mobile app | Press Resume | The clock runs again |
| 26 | 📱 mobile app | Press Back to Home, leaving the ride running | Home shows the ride in progress |
| 27 | ⌚ watch app | Press Pause on the wrist | The phone shows Paused and the clock freezes |
| 28 | 🤚 physical | Keep pedalling for 20 seconds | Both devices stay Paused |
| 29 | ⌚ watch app | Press Resume on the wrist | Both run again |
| 30 | ⌚ watch app | Press End on the wrist, with the phone still sitting on Home | The phone opens the ride summary by itself |
| 31 | 📱 mobile app | Press Save | The ride lands in History |

### Block D, Watch lifecycle under fast and out-of-order commands · ~15 min

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 32 | 📱 mobile app | **Settings tab**, set the heart rate source back to Apple Watch | Apple Watch selected |
| 33 | 📱 mobile app | **Home tab**, start a ride and pedal until heart rate appears | The Watch shows the ride, heart rate reaches the phone |
| 34 | 📱 mobile app | Press Pause and then Resume within about one second | The ride ends up **running** on both devices, with heart rate still arriving. It must not be left paused |
| 35 | ⌚ watch app | Do the same fast pair on the wrist: Pause then Resume within about a second | Same result: both end up running |
| 36 | 📱 mobile app | Press Pause and then Finish within about half a second | The ride ends. The Watch leaves the workout, shows no error, and does not stay on a workout screen |
| 37 | 📱 mobile app | Save or discard that ride, then start a new one and pedal 30 seconds | The ride is running on both devices |
| 38 | 🤚 physical | Lower your wrist so the Watch screen sleeps, and keep it down | The Watch screen is off |
| 39 | 📱 mobile app | Press Pause, wait 5 seconds, press Resume, wrist still down | The phone shows the ride running |
| 40 | 🤚 physical | Raise your wrist so the Watch app comes to the front, then wait 15 seconds | The Watch shows the ride **running**. It must not flip to paused when it catches up |
| 41 | 📱 mobile app | Press Finish, then Save | The summary opens, the ride lands in History |

While the Watch app is in the background its heart rate tile can read `--`. That is an accepted OS
behaviour, not a failure of this pass; see the accepted limitations below.

### Block E, Apple Health save of a paused ride · ~12 min

Use the phone's own clock for the timings. The point is a ride whose active time is clearly shorter
than its wall clock span.

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 42 | 📱 mobile app | **Home tab**, start a ride and pedal for a full 2 minutes | The clock reaches about 2:00 |
| 43 | 📱 mobile app | Press Pause and wait exactly 1 minute without pedalling | Elapsed stays at about 2:00 for the whole minute |
| 44 | 📱 mobile app | Press Resume and pedal another 2 minutes | The clock reaches about 4:00 |
| 45 | 📱 mobile app | Press Pause, and then Finish **while still paused** (do not resume first) | The summary opens showing about 4 minutes |
| 46 | 📱 mobile app | Press Save, then save the ride to Apple Health from the summary | The app confirms the save without an error |
| 47 | 📱 **iOS Health app** | Open the new Indoor Cycle workout for that moment | Its **duration** reads about **4 minutes**, not about 5. The workout's start and end still span the whole 5 minutes, and the heart rate series covers the whole span |
| 48 | 📱 **iOS Health app** | Check there is exactly one workout for that ride | One entry, no duplicate |

The app's own success message at step 46 only means the payload was sent. The **Health app is the
evidence**, so do not skip steps 47 and 48.

### Block F, an upload killed mid-flight · ~10 min

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 49 | 📱 mobile app | **History tab**, open a saved ride that is not yet in Apple Health, and start its Apple Health save | The row reads Uploading |
| 50 | 🤚 physical | While it still reads Uploading, force-quit the app from the app switcher (swipe up) | The app closes |
| 51 | 📱 mobile app | Relaunch and open that same ride | The row reads **Check Apple Health** with an explanation. It must not be stuck on Uploading, and must not read Failed |
| 52 | 📱 **iOS Health app** | Look for that ride | Note whether it is there or not, you need this for the next step |
| 53 | 📱 mobile app | Pick **Already There** if step 52 found it, or **Upload Again** if it did not | The row settles to uploaded |
| 54 | 📱 **iOS Health app** | Check that ride again | Exactly **one** workout for it. Not two |

### Block G, Strava round trip and exported distance · ~10 min, conditional

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 55 | 📱 mobile app | **Settings tab**, Integrations, check Strava | If it reads Reconnect Required, or an upload comes back with an error, **stop block G here and say so**. That is a known Strava account state, not our bug (see troubleshooting) |
| 56 | 📱 mobile app | Record a short ride of a known distance, about 0.5 km, with the bike's odometer left at its non-zero lifetime total. Save it | The ride shows about 0.5 km in the app |
| 57 | 📱 mobile app | Upload that ride to Strava | The row reads uploaded |
| 58 | 📱 Strava | Open the new activity | Its distance is about 0.5 km, matching the ride. It must not show the bike's lifetime odometer, and the distance must not jump backwards partway through |
| 59 | 🤚 physical | Repeat steps 49 to 53 against Strava this time: start the upload, force-quit mid-upload, relaunch, then choose Upload Again | The row settles to uploaded |
| 60 | 📱 Strava | Check your activity list | Exactly **one** activity for that ride. A duplicate here is a failure |

## Pass criteria

| # | Check | Pass | Fail |
| --- | --- | --- | --- |
| 1 | Migrations on a real database (A07, A08, A11) | Every pre-upgrade ride still in History with its numbers | Missing rides, wrong numbers, or the app never finishes opening |
| 2 | Cancelled start before Health consent (A09) | No workout on the Watch after answering the prompt late | A workout starts for a ride that was already ended |
| 3 | Strap returns inside the retry window (A05, A10) | Back to Ready on its own after a quick off and on | Stays disconnected, or the card never leaves Connecting |
| 4 | Retry budget is bounded (A10) | Stops trying after a few seconds, Retry dials again and succeeds | Endless retrying, or Retry does nothing |
| 5 | Bike power cut freezes the ride once (A05) | Clock stops within a second or two, one freeze, resumes cleanly | A long delay before freezing, a double freeze, or the clock keeps running |
| 6 | No reconnect after a normal finish (A05) | Both cards stay disconnected for a full minute after Save | Either device dials itself back up |
| 7 | One ride clock across navigation (A01) | About 30 seconds gained over a 30 second absence | Roughly double, or the clock reset |
| 8 | Manual pause beats the bike (A06) | Stays paused while you keep pedalling, phone and wrist | The ride resumes itself |
| 9 | On-wrist End with no ride screen open (A01) | The phone opens the summary by itself | Nothing happens on the phone, or the ride keeps running |
| 10 | Fast pause then resume (A09) | Ends up running, both devices agree, heart rate flowing | Left paused, or the two devices disagree |
| 11 | Finish landing on top of a pause (A09) | Ride ends once, Watch leaves the workout, no error | The Watch stays in a workout, or shows an error |
| 12 | Queued command delivered late (A09) | The Watch catches up to **running**, and stays running | The Watch flips to paused when it reconnects |
| 13 | Apple Health duration (A08) | About 4 minutes for a ride with a 1 minute pause inside a 5 minute span | About 5 minutes, meaning the pause was ignored |
| 14 | Apple Health samples still span the ride (A08) | Heart rate series covers the whole 5 minutes | Samples cut off at 4 minutes, or missing |
| 15 | Interrupted upload is disclosed (A03) | Reads Check Apple Health / Check Strava after the relaunch | Stuck on Uploading, or silently Failed |
| 16 | No duplicate after the decision (A03) | Exactly one workout or activity | Two |
| 17 | Exported distance is the ride's (A07) | About 0.5 km on Strava | The bike's lifetime odometer, or a distance that jumps backwards |

## What to report back

Say **"done"**, and for anything that did not match, give the **step number** and one line on what you
saw instead. If you stopped early, say at which step and why.

Do not run any commands and do not read any logs. I pull the phone and Watch logs myself and give a
fact based verdict against the table above.

## Accepted, do not report these as failures

- **The Watch heart rate tile reads `--` while the Watch app is in the background.** That is watchOS
  suspending and batching, not a defect, and it is explicitly out of scope: A11 says not to turn an
  accepted background limitation into a new requirement.
- **A Strava activity shows a paused ride as one continuous effort.** Known and tracked as
  [A12](issues/A12-tcx-paused-intervals.md). Apple Health gets the pauses, TCX does not yet.
- **A ride recorded before this build exports to Apple Health as one continuous effort.** Deliberate
  A08 policy: those rides have no recorded pause history, and inventing one would mark real effort as
  a break.
- **The retry budget stopping after a few seconds.** That is the designed 3 probe budget (immediate,
  +3 s, +5 s), not a hang. Retry restores the full budget.

## Not covered by this pass, and why

| Ticket | What stays unproven | Why not here |
| --- | --- | --- |
| A02 | A real SQLite write failure at finish | Needs a build with fault injection. No user action can force a disk write to fail |
| A04 | The energy-only FTMS path over real Bluetooth | Needs a trainer that reports Total Energy but never Instantaneous Power. If you have one, connect it and record a ride: calories must keep counting, and must come from the bike rather than stalling at zero |
| A08 | A `addWorkoutEvents` rejection from HealthKit | Log and continue branch with no known trigger; it would only ever show up as a native log line beside a workout that still saved |
| A09 | The unstamped HealthKit wake starting a workout for a stopped ride | Accepted residual recorded in the ticket, needs ride identity the wake cannot carry. A separate ticket, not a check here |

## Troubleshooting

- **The Watch reads "Unavailable" on the phone.** The companion is not installed as a matched pair.
  Stop, reinstall from Xcode with the `omnibikern` scheme, and start again. Do not run the pass with a
  mismatched pair: A09's `sentAtMs` wire change means the result would be meaningless. (memory
  `watch-companion-install-mismatch`)
- **Strava says Reconnect Required, or every upload errors.** Almost certainly the Strava API
  application is `Inactive`, which since 2026-06-30 means the API application owner has no paid Strava
  subscription. Reconnecting or issuing a new token changes nothing, and Disconnect risks losing
  working tokens. Skip block G and report it. (memory `strava-api-inactive-subscription`)
- **iOS shows a security message instead of launching.** The developer profile is not trusted yet.
  iPhone, **iOS Settings** app, General, VPN and Device Management, then relaunch. No rebuild needed.
- **Xcode cannot reach the Watch, or reports a transport or preparation error.** A stuck CoreDevice
  tunnel. Keep the iPhone tethered, both devices unlocked and on the same Wi-Fi, and restart Xcode. Do
  not reset the Watch or its data. (memory `watch_reconnect_fix`)
- **The bike will not connect at all.** Wake it from standby and check nothing else is already paired
  to it. The iOS Simulator cannot do BLE, so there is no fallback here.

## Agent side evidence, not part of the tester's run

Recorded here because this document outlives the session that wrote it. The tester runs none of this.

| Block | Log to pull | What settles it |
| --- | --- | --- |
| B, C | Metro `[WC-JS]` traces plus the phone `Documents/wc.log` | Disconnect observed natively rather than inferred from sample silence; one reconnect cycle |
| D | Watch `Documents/wc.log`, the `applyCommand` and `reconcile` lines, correlated with the phone's | Ordering by `sentAtMs`, one `reconcile: ending`, `didChangeTo 3`, no `didFailWithError` |
| E | Phone `Documents/apple-health.ndjson`, the `saveWorkout-success` entry | `workoutEvents`, `impliedActiveSeconds` and `recordedElapsedSeconds` |
| F, G | Same diagnostics file plus Metro | Which provider call ran, and whether a second `exportSession` was issued |

**Trap, read before rendering a verdict on block E.** `saveWorkout-success` writes
`impliedActiveSeconds` from the payload the app assembled, computed by `impliedActiveSeconds()` in
`src/services/health/workoutPauseEvents.ts`. HealthKit can refuse `addWorkoutEvents` and the ride still
saves by design, and that log line will be identical either way. It describes what was sent, never
what Health holds. Only the tester's reading of the Health app duration at step 47, or the native
`[AppleHealthWorkoutModule] addWorkoutEvents failed` line, settles criterion 13.

Log pull commands, device identifiers and the log line glossary live in the `manual-test-handoff`
skill (`ai/skills/manual-test-handoff/SKILL.md`), not duplicated here.

## After the pass

Record the outcome in [A11](issues/A11-native-upgrade-verification.md) with the build revision,
device and OS versions, and the per criterion result. Then tick the matching device box in each
ticket the run covered and move it to Done: A03 (two boxes), A05, A08 (two boxes), A09, A10. A ticket
whose check failed stays open with the failure recorded, and gets its own remediation ticket.
