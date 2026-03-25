# Omni Bike - Project Plan

See `PROJECT.md` for business requirements, functional requirements, and technology stack.

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

- [R] App shell and bottom-tab navigation (`Home`, `History`, `Settings`) with dedicated `Training` and `Summary` screens
- [ ] Functional home / setup screen (resume interrupted session, My Bike, Heart Rate, Start training, History / Settings entry points)
- [ ] Functional gear setup flow (select single main bike and HR source)
- [ ] Support standard Bluetooth HR sensors (for example chest straps such as Garmin HRM-Dual), including compatible watches that can broadcast heart rate as sensors
- [ ] Validate selected bike and HR devices during gear setup against the required sensor mode
- [ ] Explain unsupported or incompatible devices clearly and prevent saving gear that does not provide the required live data mode
- [ ] Require live metric / HR signal before saving preferred gear
- [ ] Remember selected main bike and preferred Bluetooth HR source
- [ ] Auto-reconnect saved main bike and preferred Bluetooth HR source on app launch / setup screen
- [ ] Inline reconnect failure states on Home / My Gear with actions such as `Retry`, `Choose another device`, and `Forget device`
- [ ] Minimal My Gear management in Settings (view saved bike and HR source, replace device, forget device, reconnect)
- [ ] Extensible gear model for future FTMS equipment types (bike first, treadmill later)
- [ ] Functional Settings screen
- [ ] Just-in-time permission UX for Bluetooth scanning / connection
- [ ] Add comprehensive unit tests covering various test cases

## Phase 3: Core Training UX & Persistence

- [x] Zustand store + Metronome engine (1 Hz sampling, JSI optimized)
- [x] Training state machine (Idle → Active → Paused → Finished)
- [x] Auto-pause/resume via FTMS Machine Status (pause when bike detects no pedaling)
- [ ] Functional training dashboard screen (Time, Speed, HR, Power, Calories)
- [ ] Portrait and landscape training layouts
- [ ] Local DB schema + session persistence (Drizzle + expo-sqlite)
- [ ] Crash recovery / interrupted session restore
- [ ] Finish flow from app: confirmation before completing, then navigate to summary and auto-save the completed workout
- [ ] Bike stop handling: freeze the session and prompt the user to finish instead of auto-completing immediately
- [ ] Finished workout summary screen (save, upload, export entry points)
- [ ] Live Activities & Dynamic Island integration (`react-native-activity-kit`)
- [ ] Add comprehensive unit tests covering various test cases

## Phase 4: Advanced HR Sources & Watch Integration

Standard Bluetooth HR sensors are expected to work via the BLE HR flow before this phase. This phase focuses on watch-specific integrations and advanced HR-source behavior.

- [ ] Extend gear setup and Settings to support watch-based HR sources
- [ ] Support Apple Watch as a native selectable HR source
- [ ] Support compatible broadcast-capable watches (for example Garmin) as Bluetooth HR sources when the watch can transmit HR without owning the workout
- [ ] Native WatchOS companion app (SwiftUI + HealthKit workout session)
- [ ] Real-time HR streaming via WatchConnectivity
- [ ] HR source priority logic (Watch > BLE HR monitor > Bike pulse)
- [ ] Background recording with BLE + Watch
- [ ] Just-in-time permission UX for watch / health integrations
- [ ] Minimal UI elements needed for watch status and source visibility
- [ ] Add comprehensive unit tests covering various test cases

## Phase 5: Workout History & Management

- [ ] Functional session history list + detail view with summary statistics
- [ ] Session deletion
- [ ] Minimal UI elements needed for history flows
- [ ] Add comprehensive unit tests covering various test cases

## Phase 6: Integrations & External Provider Sync

- [ ] Functional Integrations screen
- [ ] External training provider contract / adapter architecture for finished session uploads
- [ ] Provider connection management (connect, disconnect, sync status)
- [ ] Generic export payload mapping for completed training sessions
- [ ] Upload flow for completed workouts with states: `ready to upload`, `uploading`, `uploaded`, `failed`
- [ ] If a user taps `Upload` without a connected provider, redirect to the relevant provider connection flow
- [ ] Retry flow for failed uploads
- [ ] First provider integration: Strava OAuth + finished session upload
- [ ] Apple Health export via `react-native-health` (completed sessions only)
- [ ] Raw `.FIT` binary file export generation
- [ ] Minimal UI elements needed for integrations, export, and provider sync flows
- [ ] Add comprehensive unit tests covering various test cases

## Phase 7: UX & Visual Design Polish

- [ ] Visual design pass across training, history, and sync screens
- [ ] Refine dashboard information hierarchy, spacing, and responsiveness
- [ ] Polish empty, loading, error, paused, and finished states
- [ ] Add motion, typography, theming, and interaction polish
- [ ] Final cross-screen QA for portrait, landscape, and iOS live surfaces
