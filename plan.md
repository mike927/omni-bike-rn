# Omni Bike - Project Plan

See `PROJECT.md` for business requirements, functional requirements, and technology stack.

## Task State Legend

- `[ ]` not started
- `[~]` in progress
- `[?]` blocked or needs clarification
- `[R]` implemented and in review / approved / waiting for merge
- `[x]` merged and completed
- `[-]` intentionally skipped or deferred

## Product Flow Notes

- Onboarding should not require provider login. Provider authentication belongs in Integrations and upload flows.
- App navigation should use bottom tabs for `Home`, `History`, and `Settings`. `Training` and post-workout `Summary` remain focused non-tab screens.
- Permissions should be requested just-in-time when the user starts a relevant action (for example scan/connect gear, enable live activities, or connect a health/watch integration).
- Manual in-app pause takes precedence over automatic bike-driven resume. Bike-reported stop should freeze the workout and prompt the user to finish rather than auto-completing immediately.
- Completed workouts should use simple upload states: `ready to upload`, `uploading`, `uploaded`, `failed`.

## Current Priority: Screen Logic Revision

Consolidates remaining Phase 3 finish flow and Phase 5 onboarding into a single revision that simplifies the screen flow end-to-end. Branch: `feature/screen-logic-revision`.

- [x] First-launch onboarding gate (preferences storage, swipeable intro, root layout gate)
- [x] Streamlined finish flow (single Finish action: complete + disconnect + auto-navigate to Summary)
- [x] DB-driven Summary screen with Discard / Save actions
- [x] Simplified Home screen (Quick Start button, bike tile, HR tile, latest workout card)
- [x] Screen architecture diagram update (`ai/screens.md`)
- [x] Unit tests for new flows

## Phase 1: Foundation & BLE Core

- [x] Expo project scaffold, TypeScript, ESLint, Prettier (Enforce New Architecture/JSI)
- [x] CI pipeline (GitHub Actions: lint, typecheck, test)
- [x] Domain-driven folder structure (`/src/features`, `/src/services`, etc.)
- [x] BLE scanning & connection to Zipro Rave
- [x] Raw metric parsing (FTMS Indoor Bike Data + Machine Status)
- [x] BLE HR monitor support (standard HR Service `0x180D`)
- [x] Add comprehensive unit tests covering various test cases

## Phase 2: App Shell, Onboarding & Gear Setup

Functional UI only in this phase: focus on usable layouts, controls, and required page elements; defer visual polish to the final phase.
Bike-first product UX in this phase: support a single main bike for now, while keeping the gear model extensible for future FTMS equipment types such as treadmills.

- [x] App shell and bottom-tab navigation (`Home`, `History`, `Settings`) with dedicated `Training` and `Summary` screens
- [x] Functional home / setup screen (resume interrupted session, My Bike, Heart Rate, Start training, History / Settings entry points)
- [x] Functional gear setup flow for the single main bike
- [x] Support standard Bluetooth HR sensors (for example chest straps such as Garmin HRM-Dual)
- [x] Validate selected bike devices during gear setup against the required sensor mode
- [x] Validate HR devices during gear setup against the required sensor mode
- [x] Explain unsupported or incompatible bike devices clearly and prevent saving gear that does not provide the required live data mode
- [x] Explain unsupported or incompatible HR devices clearly and prevent saving gear that does not provide the required live data mode
- [x] Require live bike metrics before saving preferred gear
- [x] Require live HR signal before saving preferred HR source
- [x] Remember selected main bike
- [x] Remember preferred Bluetooth HR source
- [x] Auto-reconnect saved main bike on app launch / setup screen
- [x] Auto-reconnect saved preferred Bluetooth HR source on app launch / setup screen
- [x] Inline reconnect failure states on Home / My Gear with actions such as `Retry`, `Choose another device`, and `Forget device`
- [x] Minimal My Gear management in Settings for saved bike
- [x] Minimal My Gear management in Settings for saved HR source
- [x] Extensible gear model for future FTMS equipment types (bike first, treadmill later)
- [x] Functional Settings screen
- [x] Just-in-time permission UX for Bluetooth scanning / connection
- [x] Add comprehensive unit tests covering various test cases

## Phase 3: Core Training UX & Persistence

- [x] Zustand store + Metronome engine (1 Hz sampling, JSI optimized)
- [x] Training state machine (Idle → Active → Paused → Finished)
- [x] Auto-pause/resume via FTMS Machine Status (pause when bike detects no pedaling)
- [x] Functional training dashboard screen (Time, Speed, HR, Power, Calories)
- [x] Portrait and landscape training layouts - closed by product decision: app remains portrait-only
- [x] Local DB schema + session persistence (Drizzle + expo-sqlite)
- [x] Finish flow from app: confirmation before completing, then navigate to summary and require an explicit save-or-discard choice when tapping `Done` — addressed in Screen Logic Revision
- [x] Finished workout summary screen (save, discard, deferred upload entry points) — addressed in Screen Logic Revision
- [-] Bike stop handling: freeze the session and prompt the user to finish instead of auto-completing immediately - deferred by product decision
- [x] Parse and use bike-reported calories from FTMS Energy field (Zipro Rave Bit 10) as an alternative calorie source
- [x] Crash recovery / interrupted session restore

## Phase 4: Workout History & Management

- [x] Functional session history list + detail view with summary statistics
- [x] Session deletion
- [x] Minimal UI elements needed for history flows
- [x] Add comprehensive unit tests covering various test cases

## Phase 5: First-Launch Onboarding

Lightweight, modern onboarding shown only on first launch. 2-3 swipeable intro screens that explain the app setup flow (connect bike, optional HR source, start training). No interactive walkthrough — just clear, visual guidance so the user knows what to expect before landing on the Home screen.

- [x] First-launch detection and persistence (show once, remember dismissal) — addressed in Screen Logic Revision
- [x] Swipeable onboarding screen with 2-3 pages (connect bike → optional HR → start training) — addressed in Screen Logic Revision
- [ ] Modern, visually polished design (animations, illustrations, smooth transitions) — deferred to Phase 9
- [x] Skip and Done actions — addressed in Screen Logic Revision

## Phase 6: Integrations & External Provider Sync

- [x] External training provider contract / adapter architecture for finished session uploads
- [x] First provider integration: Strava OAuth + finished session upload
- [x] Upload flow for completed workouts with states: `ready to upload`, `uploading`, `uploaded`, `failed`
- [x] Retry flow for failed uploads
- [x] Provider connection management (connect, disconnect, sync status)
- [ ] Settings option to automatically upload saved workouts to a connected provider
- [x] Manual upload action from the workout history list or workout detail view
- [x] Functional Integrations screen
- [x] Generic export payload mapping for completed training sessions
- [ ] Garmin Connect as additional upload provider (OAuth + .FIT upload, sitting alongside Strava via the existing provider-adapter contract; depends on Phase 7 .FIT export)
- [ ] If a user taps `Upload` from history without a connected provider, redirect to the relevant provider connection flow
- [x] Minimal UI elements needed for integrations, export, and provider sync flows
- [x] Strava webhook is not working for "localhost" once oauth is agreed - it hangs on "accounts.google.com"

## Phase 7: Extras & Platform Features

- [ ] Live Activities & Dynamic Island integration (`react-native-activity-kit`)
- [x] Apple Health export via `react-native-health` (completed sessions only)
- [ ] Raw `.FIT` binary file export generation

## Phase 8: Advanced HR Sources & Watch Integration

Standard Bluetooth HR sensors are expected to work via the BLE HR flow before this phase. Broadcast-capable watches such as Garmin or Polar stay on that same Bluetooth HR path when they expose the standard BLE HR service. Apple Watch is a separate native integration and must only be surfaced on iPhone, never on Android. During this phase the app remains the owner of the workout session; watches act as HR sensors unless a later native watch integration explicitly says otherwise.

- [x] HR priority scaffold + Bluetooth HR UX cleanup
- [~] Extend gear setup and Settings to support native watch-based HR sources
- [x] Support Apple Watch as an iPhone-only native selectable HR source
- [x] Support compatible broadcast-capable watches (for example Garmin or Polar) as Bluetooth HR sources when the watch can transmit HR without owning the workout — runtime HR path (`StandardHrAdapter`, `validateHrDevice`, `isLikelyHrCandidate`) is vendor-agnostic and routes solely on `0x180D` / `0x2A37` + wearable vendor Company ID allowlist (Garmin 0x0087, Polar 0x006B, Suunto, COROS, Amazfit, Wahoo); hardware-verified negative on Venu gen 1 fw 7.80 (Broadcast feature is ANT+ only on this model, watch never emits a BLE advertisement in any broadcast variant — see `docs/vendor/garmin/hr-broadcast/README.md` Compatibility section); expected to work unmodified on Venu 2+ / Fenix 6+ / Forerunner 245+ / Vivoactive 4+ per Garmin's public support matrix
- [ ] Garmin Connect IQ companion app for one-tap start/stop sync between the iOS app and a Garmin watch (Monkey C; store-distributed; mirror of the Apple Watch companion task above)
- [x] Native WatchOS companion app (SwiftUI + HealthKit workout session)
- [x] Real-time HR streaming via WatchConnectivity
- [x] HR source priority logic (Watch > BLE HR monitor > Bike pulse)
- [?] Programmatic Watch app wake-on-start from iPhone (`HKHealthStore.startWatchApp` + `workoutSessionMirroringStartHandler`) — canonical WWDC23 flow implemented but Watch never wakes on our sideload install; leading suspect is the free-account `devicectl` install path bypassing HealthKit's wake broker. Current UX requires the user to open the Watch app manually before training. Full findings and next experiments: `docs/apple-watch/wake-on-start.md`
- [ ] Background recording with BLE + Watch
- [~] Just-in-time permission UX for watch / health integrations
- [~] Minimal UI elements needed for watch status and source visibility

## Phase 9: Calorie Accuracy & User Profile

Three-part initiative to align our calorie numbers with Apple Fitness and Strava, and make the app accurate for users outside Apple's ecosystem.

### Part A: Live calories on dashboard + Watch-computed source

- [x] Add live Calories tile to training dashboard
- [x] Enable Watch-side collection of active calories during the workout session
- [x] Stream Watch-computed calories alongside HR via WatchConnectivity
- [x] Source priority: Watch > existing power-based formula
- [x] Fallback when no Watch connected: keep current power-based calculation

### Part B: Active vs. Total split in Apple Health upload

- [x] Post-session HealthKit query for basal energy over the workout interval
- [x] Native module accepts separate active + basal calorie parameters
- [x] Emit two samples (active + basal) per saved workout so Apple Fitness shows distinct Active / Total values
- [x] Strava upload unchanged — still receives a single Total value

### Part C: User Profile for personalized calorie calculation

- [x] User Profile screen in Settings (sex, date of birth, weight, height)
- [x] On-demand sync from Apple Health via explicit button (replaces planned auto-fill on connect; overwrites all returned fields, leaves omitted fields untouched)
- [x] On-demand sync from Strava via explicit button (weight + sex only; same omit-preserves semantics)
- [x] Per-field source indicator ("Apple Health" / "Strava" / "Manual")
- [x] Local persistence; manual edits stay until the user taps Clear or triggers a sync (sync is now explicit, so provider always wins on user request)
- [x] HR-based formula (Keytel) when external HR + profile both available
- [x] Basal fallback: Mifflin–St Jeor when HealthKit returns no samples (depends on user profile)
- [x] Final source priority: Watch > HR + profile (Keytel) > power-based > bike-reported
- [x] Graceful degradation: missing profile never blocks calorie calculation

## Phase 10: UX & Visual Design Polish

- [ ] Visual design pass across training, history, and sync screens
- [ ] Refine dashboard information hierarchy, spacing, and responsiveness
- [ ] Polish empty, loading, error, paused, and finished states
- [ ] Add motion, typography, theming, and interaction polish
- [ ] Final cross-screen QA for portrait and iOS live surfaces

## Android Parity (Deferred)

Android is not actively supported today — the product is iOS-first (watchOS companion, HealthKit, Apple Watch HR). Android scaffolding exists in `app.config.ts`, but platform-specific regressions are tracked here for a future pass.

- [ ] Strava OAuth on Android: `WebBrowser.openBrowserAsync` resolves with `{ type: 'opened' }` immediately on Android (the runtime cannot observe the Chrome Custom Tab close), so the iOS-focused fix in PR [#56](https://github.com/mike927/omni-bike-rn/pull/56) rejects the auth flow before the deep link can arrive. Fix: add a `Platform.OS` split — keep the new `openBrowserAsync` + `Linking` flow on iOS, restore `openAuthSessionAsync` on Android.

## Future Considerations

- [ ] Move Strava OAuth token exchange and refresh behind a backend or other secure server-side flow so the client app no longer ships the Strava client secret
- [ ] Align the Strava OAuth callback route with the configurable callback host. The expo-router handler added in PR [#56](https://github.com/mike927/omni-bike-rn/pull/56) is hardcoded at `app/localhost/oauth/callback.tsx`, but `STRAVA_REDIRECT_URI` uses the configurable `stravaCallbackDomain` from `app.config.ts` (env: `STRAVA_CALLBACK_DOMAIN`). In any environment that overrides the domain, expo-router will fall back to `+not-found`. Fix: either hardcode `localhost` everywhere (remove the env override) or switch to a dynamic segment (`app/[callbackDomain]/oauth/callback.tsx`). No immediate action needed — `localhost` is the only domain in use.
