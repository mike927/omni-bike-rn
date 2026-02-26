# Omni Bike - Project Plan

## 1. Business Requirements
- **Core Value Proposition**: Provide a single, unified view of a user's indoor cycling training session by combining data from a stationary bike and a smartwatch.
- **Target Audience / Distribution**: Initially, a personal tool for a single user (iOS only). It does not need to be published to the App Store for the MVP, but the underlying architecture must support future App Store/Play Store distribution and multi-user scale.
- **Data Portability**: Enable users to easily export their complete, enriched workout data to popular fitness platforms (Strava, Apple Fitness) to maintain their long-term fitness history.

## 2. Functional Requirements
### 2.1. Connectivity & Device Discovery
- **Bike Trainer (Primary Source)**:
  - Scan for and discover BLE (Bluetooth Low Energy) bike trainers.
  - Connect to a selected bike trainer (Initial target: "Zipro Rave").
  - Extensible design to allow adding support for other bike models.
- **BLE Heart Rate Monitor (Secondary Source — Phase 1)**:
  - Scan for and connect to any standard BLE Heart Rate peripheral (chest strap, armband) using the HR Service UUID `0x180D`.
  - Reuses the same BLE infrastructure as the bike connection.
- **Apple Watch (Tertiary Source — Phase 3)**:
  - A native WatchOS companion app streams real-time HR via WatchConnectivity.
  - Provides Watch-on-wrist convenience as a premium upgrade over a standalone HR monitor.

### 2.2. Data Collection & Processing
- **Measurements (Bike Trainer)**: The Zipro Rave console displays **Time, Speed (KPH), Distance, Power (Watt), Cadence (RPM), Calories, and Pulse (HR)**. Actual BLE availability to be confirmed during device discovery in Phase 1.
- **Heart Rate Sources** (in priority order):
  1. **Apple Watch** (WatchOS companion app — Phase 3)
  2. **BLE HR Monitor** (chest strap / armband — Phase 1)
  3. **Bike Trainer Pulse** (handlebar grip sensors — lowest accuracy)
- **Real-Time Data Linking (The iConsole+ Concept)**:
  - **Asynchronous Sources**: The Bike (via BLE) and HR source (BLE HR monitor or Watch via WatchConnectivity) send updates at different, unpredictable frequencies.
  - **Unified State**: The mobile app maintains a central "Current Metrics State" in memory. When the Bike sends a power update, only the power value is overwritten. When the HR source sends an update, only the HR value is overwritten.
  - **Synchronized Sampling (The Metronome)**: A central timer ticks every 1 second. On each tick, it takes a "snapshot" of the Unified State, creating a complete `TrainingDataPoint` (e.g., `{ time: 1s, power: 200W, cadence: 90rpm, hr: 145bpm }`).
  - **UI & Storage**: This 1-second sampled stream drives the Live Dashboard and is stored in the local database, ensuring perfect alignment between all data sources.

### 2.3. Training Session Management
- **Modes**: Initialization with "Free Ride" (passive recording of metrics). The data architecture (`TrainingSession` entities) must natively support adding "Structured Workouts" (target metrics, intervals) in the future.
- **Controls**: Users can Start, Pause, Resume, and Stop a training session.
- **Bidirectional Session Sync (Bike ↔ App)**:
  - **App → Bike**: When the user starts a session in the app, it should send a BLE write command to start the Zipro Rave (if supported by the device's BLE profile). This avoids having to press START on both devices.
  - **Bike → App**: When the user presses START or STOP on the Zipro Rave itself, the app must detect this (via BLE signal — e.g., metrics appearing/zeroing, a characteristic change, or connect/disconnect) and automatically start the session or transition to the Session Summary screen.
  - BLE write capability and exact detection signals to be confirmed during device discovery in Phase 1. If the bike does not support BLE write commands, the app-side Start button will only start the app's recording and the user must press START on the bike manually.
- **Session Completion Flow**: When the user taps Stop, the app transitions to a **Session Summary** screen showing key stats (duration, avg/max speed, avg/max HR, distance, calories). From there, the user can Save (with optional rename) or Discard the session.
- **Session Naming**: Sessions are auto-titled using time-of-day context (e.g., "Morning Ride — Feb 26, 2026", "Evening Ride — Feb 26, 2026"). Users can optionally rename on the Summary screen or later from History.
- **Live Dashboard**: 
  - **Initial Metrics (MVP)**: Display large, clean, easy-to-read numbers for Elapsed Time, Speed, and Heart Rate.
  - **Extensibility**: The UI layout (e.g., a dynamic grid system) and the underlying State (Zustand store) must be designed to easily accept and render new data points (e.g., Power, Cadence, Elevation) in the future without major refactoring.

### 2.4. Data Model
- **Units**: Metric only for MVP (KPH, km, Watt, bpm). All display values must flow through a formatting/units utility layer so imperial support can be added later without touching business logic.
- **`TrainingSession`**: `id`, `title`, `startedAt`, `endedAt`, `duration`, `status` (completed | discarded), `avgSpeed`, `maxSpeed`, `avgHr`, `maxHr`, `totalDistance`, `totalCalories`, `syncedToStravaAt`, `syncedToHealthAt`.
- **`TrainingDataPoint`**: `id`, `sessionId`, `timestamp`, `elapsedSeconds`, `speed`, `power`, `cadence`, `heartRate`, `distance`, `calories`.
- Schema must include sync-related fields (`synced_at`, `remote_id`) from day one even if unused in MVP.

### 2.5. Data Storage, History & Sync
- **Local Storage**: Save completed sessions locally on the mobile device (offline-first).
- **Future-Proof Architecture**: The database schema and authentication flows must be designed from day one to support future remote API synchronization (e.g., storing a `synced_at` timestamp or `remote_id`) and Single Sign-On (SSO) capabilities like Google Login, even if unused in the MVP.
- **History View**: Browse past sessions and view summary statistics.
- **Data Management**: Delete unwanted or test sessions.
- **Manual Synchronization**: Provide buttons to trigger upload of the combined workout data to Strava and Apple Fitness.

### 2.6. App Navigation Structure
- **Tab-based navigation** with the following primary tabs:
  1. **Training** — Device connection status + Start Session button → Live Dashboard during active session.
  2. **History** — List of past sessions → Session detail view.
  3. **Devices** — Scan, connect, and manage BLE devices (bike trainer + HR monitor). Shows connection state and battery level (if available).
- **Modal flows**: Session Summary (post-stop) presented as a modal over the Training tab.

### 2.7. Onboarding (First Launch)
- On first launch, the app presents a guided setup flow:
  1. **Welcome** — Brief intro to the app.
  2. **Bluetooth Permission** — Request BLE access with explanation of why it's needed.
  3. **Pair Bike Trainer** — Scan and connect to the Zipro Rave (required to proceed).
  4. **Pair HR Monitor** — Scan and connect to a BLE HR peripheral (optional, can skip).
  5. **Ready** — Confirmation screen, transition to the Training tab.
- Onboarding state persisted locally so it only runs once. Devices can be re-paired later from the Devices tab.

## 3. System Behaviors & Edge Cases
### 3.1. Background Processing
- Like the native Apple Fitness app, the application must continue to actively record the training session, maintain Bluetooth connections, and sync data when the app is backgrounded or the screen is locked.
- **Requires Custom Dev Client** (not Expo Go) with `UIBackgroundModes` (`bluetooth-central`) configured in `Info.plist`.

### 3.2. Sync Frequency & Reconnection
- **Capture Rate**: Data should be captured and synchronized into the `TrainingDataPoint` array at a frequency of **1 Hz (Once per second)**. Since metrics like Time, Distance, and Speed come directly from the external devices, the app's primary role is an aggregator, not an accumulator.
- **Bike Connection Drop**: Continue the elapsed time counter, show a "Reconnecting..." status, cleanly resume the data stream when reconnected.
- **HR Monitor Connection Drop**: Display HR as "—" (stale), show "HR Reconnecting..." status, auto-reconnect when found.
- **Watch Disconnection (Phase 3)**: If the WatchOS companion loses connectivity, fall back to BLE HR monitor or bike pulse if available, and display a reconnection indicator.

### 3.3. Permissions
- **Bluetooth**: Request on first connection attempt. If denied, show an explanation screen with a link to Settings.
- **HealthKit (Phase 4 — export only)**: Request when the user first triggers a sync to Apple Health. If denied, disable the Apple Health sync button with an explanation.

### 3.4. Crash Recovery
- The Metronome engine must **auto-save `TrainingDataPoint` snapshots** to the local database in real-time (or in small batches, e.g., every 5 seconds).
- On next app launch, if an unsaved session is detected (status = `active`), prompt the user to **Resume** or **Discard** the interrupted session.

## 4. CI/CD Pipeline
### 4.1. Pull Request Quality Gate (GitHub Actions)
Every Pull Request targeting `main` must pass the following automated checks before merge:
1. **Lint** (`npm run lint`) — ESLint with strict TypeScript and Prettier rules
2. **Type Check** (`npm run typecheck`) — TypeScript compiler with zero errors
3. **Unit Tests** (`npm test`) — Jest test suite with all tests passing

### 4.2. Workflow Configuration
- **Trigger**: On `pull_request` events targeting `main`
- **Runner**: `ubuntu-latest` (latest LTS)
- **Node version**: Use `.nvmrc` or `engines` field for consistency
- **Caching**: Cache `node_modules` via `actions/cache` or `actions/setup-node` built-in caching for faster CI runs
- **Branch protection**: Enable "Require status checks to pass before merging" on `main` in GitHub repo settings

## 5. Non-Functional Requirements
- **Latency**: UI must update within ≤100ms of receiving a BLE notification.
- **Battery**: Background recording session must not drain >5% battery/hour.
- **Storage**: A 2-hour session (~7,200 data points) must occupy <1 MB on disk.
- **Startup**: Cold launch to "ready to connect" in <3 seconds.

## 6. Project Roadmap / Phases

### Phase 1: Foundation & BLE Core
- [x] Expo project scaffold, TypeScript, ESLint, Prettier
- [x] CI pipeline (GitHub Actions: lint, typecheck, test)
- [ ] Domain-driven folder structure (`/src/features`, `/src/services`, etc.)
- [ ] BLE scanning & connection to Zipro Rave
- [ ] Raw metric parsing (confirm which of the 7 console metrics are available over BLE)
- [ ] BLE HR monitor support (standard HR Service `0x180D`)
- **Done when**: Can connect to the bike, log parsed metrics, and read HR from a BLE monitor.

### Phase 2: Training Loop & Dashboard
- [ ] Zustand store + Metronome engine (1 Hz sampling)
- [ ] Training state machine (Idle → Active → Paused → Finished)
- [ ] Live Dashboard UI (Time, Speed, HR + extensible grid for future metrics)
- [ ] Local DB schema + session persistence (Drizzle + expo-sqlite)
- **Done when**: Can start/pause/stop a session and see it saved locally.

### Phase 3: Watch Integration
- [ ] Native WatchOS companion app (SwiftUI + HealthKit workout session)
- [ ] Real-time HR streaming via WatchConnectivity
- [ ] HR source priority logic (Watch > BLE HR monitor > Bike pulse)
- [ ] Background recording with BLE + Watch
- **Done when**: Combined bike + watch HR data appears in a single session.

### Phase 4: History & External Sync
- [ ] Session history list + detail view with summary statistics
- [ ] Session deletion
- [ ] Strava OAuth + session upload
- [ ] Apple Health export via `react-native-health` (completed sessions only)
- **Done when**: A completed session can be viewed, deleted, or synced to Strava / Apple Health.

## 7. Known Limitations (MVP)
- Single bike model (Zipro Rave) only
- iOS only — no Android testing
- No user authentication or cloud backup
- No structured workouts (Free Ride only)
- Apple Watch support deferred to Phase 3
- Metric units only (no imperial)
- No resistance level reading or control via BLE (out of scope)
- UI/UX design direction TBD — user will provide after browsing inspirations
