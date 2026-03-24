# Omni Bike - Project Plan

## Task State Legend

- `[ ]` not started
- `[~]` in progress
- `[?]` blocked or needs clarification
- `[R]` implemented and in review / waiting for approval
- `[x]` completed and approved
- `[-]` intentionally skipped or deferred

## Product Flow Notes

- Onboarding should not require provider login. Provider authentication belongs in Integrations and upload flows.
- App navigation should use bottom tabs for `Home`, `History`, and `Settings`. `Training` and post-workout `Summary` remain focused non-tab screens.
- Permissions should be requested just-in-time when the user starts a relevant action (for example scan/connect gear, enable live activities, or connect a health/watch integration).
- Manual in-app pause takes precedence over automatic bike-driven resume. Bike-reported stop should freeze the workout and prompt the user to finish rather than auto-completing immediately.
- Completed workouts should use simple upload states: `ready to upload`, `uploading`, `uploaded`, `failed`.

---

## Phase 1: Foundation & BLE Core ✅

- [x] Expo project scaffold, TypeScript, ESLint, Prettier (Enforce New Architecture/JSI)
- [x] CI pipeline (GitHub Actions: lint, typecheck, test)
- [x] Domain-driven folder structure (`/src/features`, `/src/services`, etc.)
- [x] BLE scanning & connection to Zipro Rave
- [x] Raw metric parsing (FTMS Indoor Bike Data + Machine Status)
- [x] BLE HR monitor support (standard HR Service `0x180D`)
- [x] Zustand store + Metronome engine (1 Hz sampling, JSI optimized)
- [x] Training state machine (Idle → Active → Paused → Finished)
- [x] Auto-pause/resume via FTMS Machine Status (pause when bike detects no pedaling)
- [x] Unit tests for BLE parsers, adapters, stores, MetronomeEngine, and hooks

## Phase 2: App Shell & Navigation

Set up the screen structure and navigation skeleton. No business logic beyond routing.

- [ ] Bottom-tab navigation (`Home`, `History`, `Settings`) via `expo-router`
- [ ] Dedicated stack screens for `Training` and `Summary` (outside tab bar)
- [ ] Placeholder content for each screen
- [ ] Just-in-time Bluetooth permission request (trigger on first scan action)
- [ ] Tests for navigation guards and permission flow

## Phase 3: Gear Setup & Device Memory

Let the user find, validate, and save preferred devices. Gear data persists via lightweight key-value storage (no SQLite yet).

- [ ] Gear setup flow: scan → select bike → verify live FTMS signal → save
- [ ] Gear setup flow: scan → select HR source → verify live HR signal → save
- [ ] Persist saved bike and HR source identifiers (`expo-secure-store` or `AsyncStorage`)
- [ ] Auto-reconnect saved devices on app launch and on Home screen focus
- [ ] Reconnection failure handling: inline states with `Retry`, `Choose another`, `Forget device`
- [ ] My Gear section in Settings: view saved devices, replace, forget
- [ ] Reject unsupported devices during setup with clear explanation (e.g. device without FTMS service)
- [ ] Tests for gear persistence, reconnection logic, and validation

## Phase 4: Training Dashboard

The core workout experience. User starts training, sees live metrics, controls the session.

- [ ] Functional training dashboard: elapsed time, speed, cadence, power, HR, calories, distance
- [ ] Portrait and landscape layouts for dashboard
- [ ] Start training from Home (only enabled when bike is connected)
- [ ] In-app pause / resume controls
- [ ] Bike stop handling: freeze session and prompt user to finish (not auto-complete)
- [ ] Finish flow: confirmation dialog → navigate to Summary
- [ ] BLE disconnection during workout: show warning, attempt reconnect, preserve session data
- [ ] Tests for dashboard state rendering and session control flows

## Phase 5: Session Persistence & History

Introduce SQLite for session storage. Record completed workouts and display them.

- [ ] Local DB schema with `drizzle-orm` + `expo-sqlite` (sessions table with metrics summary + upload status)
- [ ] Auto-save completed workout on finish
- [ ] DB migration strategy (versioned schema via Drizzle)
- [ ] Crash recovery: persist active session snapshots periodically, restore interrupted session on next launch
- [ ] Summary screen after workout: duration, distance, avg/max speed, avg/max HR, avg/max power, calories
- [ ] Session history list on History tab: date, duration, distance, upload status icon
- [ ] Session detail view with full summary
- [ ] Session deletion
- [ ] Tests for DB operations, crash recovery, and history queries

## Phase 6: Strava Integration

Primary external sync. Upload completed workouts to Strava.

- [ ] Provider adapter interface (connect, disconnect, check status, upload session)
- [ ] Strava OAuth flow (login, token storage, token refresh)
- [ ] Map completed session data to Strava activity upload format
- [ ] Upload flow with states: `ready to upload`, `uploading`, `uploaded`, `failed`
- [ ] Upload trigger from Summary screen and from History list
- [ ] If user taps Upload without connected Strava, redirect to Strava login flow
- [ ] Retry for failed uploads
- [ ] Upload status visible in History list (per-session icon)
- [ ] Strava connection management in Settings (connect, disconnect, view sync status)
- [ ] Tests for OAuth flow, upload mapping, retry logic, and status transitions

## Phase 7: Live Activities & Background Mode

Keep the workout visible when the app is backgrounded.

- [ ] Live Activities & Dynamic Island integration (`react-native-activity-kit`)
- [ ] Display key metrics on Lock Screen: elapsed time, HR, speed, power
- [ ] Start/update/end Live Activity tied to training session lifecycle
- [ ] Background BLE data collection (maintain bike + HR connections while backgrounded)
- [ ] Just-in-time permission for Live Activities
- [ ] Tests for Live Activity lifecycle sync with training state

## Phase 8: Apple Watch Companion

Native WatchOS app for HR streaming. This is a standalone sub-project within the repo.

- [ ] WatchOS app target setup (SwiftUI)
- [ ] HealthKit workout session on Watch (request permissions, start/stop mirroring phone session)
- [ ] Real-time HR streaming from Watch → Phone via WatchConnectivity
- [ ] Integrate Watch HR into MetronomeEngine (highest priority HR source)
- [ ] Watch as selectable HR source in gear setup
- [ ] Phone → Watch session status sync (show active workout state on Watch)
- [ ] Handle Watch disconnection gracefully (fall back to next HR source)
- [ ] Just-in-time permission UX for HealthKit and WatchConnectivity
- [ ] Tests for WatchConnectivity messaging and HR source fallback

## Phase 9: UX & Visual Design Polish

Refine all screens for a release-quality feel.

- [ ] Visual design pass: consistent spacing, typography, and color theme across all screens
- [ ] Dashboard information hierarchy and responsiveness refinement
- [ ] Polish all transient states: empty, loading, error, paused, disconnected, finished
- [ ] Animations and transitions (screen transitions, metric updates, connection states)
- [ ] Accessibility pass (VoiceOver labels, dynamic type, contrast)
- [ ] Final QA: portrait, landscape, Dynamic Island, Live Activities, Watch

---

## Future (post-MVP, not scheduled)

- Apple Health export (`react-native-health`, completed sessions only)
- Raw `.FIT` binary file export
- Additional provider integrations (Garmin Connect, TrainingPeaks)
- Additional FTMS device support (other bikes, treadmills)
- Cloud backup / cross-device sync
- Android support
- App Store / TestFlight release pipeline
