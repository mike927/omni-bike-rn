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
- **Watch (Secondary Source)**:
  - Connect and authorize a smartwatch (Initial target: Apple Watch).

### 2.2. Data Collection & Processing
- **Measurements**: Read Power, Cadence, and Speed from the bike trainer. Read Heart Rate from the smartwatch.
- **Data Priority**: Smartwatch Heart Rate must override Bike Trainer Heart Rate if both are present.
- **Real-Time Data Linking (The iConsole+ Concept)**:
  - **Asynchronous Sources**: The Bike (via BLE) and the Apple Watch (via a WatchOS companion app streaming HealthKit data) send updates at different, unpredictable frequencies.
  - **Unified State**: The mobile app maintains a central "Current Metrics State" in memory. When the Bike sends a power update, only the power value is overwritten. When the Watch sends a heart rate update, only the HR value is overwritten.
  - **Synchronized Sampling (The Metronome)**: A central timer ticks every 1 second. On each tick, it takes a "snapshot" of the Unified State, creating a complete `TrainingDataPoint` (e.g., `{ time: 1s, power: 200W, cadence: 90rpm, hr: 145bpm }`).
  - **UI & Storage**: This 1-second sampled stream drives the Live Dashboard and is stored in the local database, ensuring perfect alignment between bike and watch data.

### 2.3. Training Session Management
- **Modes**: Initialization with "Free Ride" (passive recording of metrics). The data architecture (`TrainingSession` entities) must natively support adding "Structured Workouts" (target metrics, intervals) in the future.
- **Controls**: Users can Start, Pause, Resume, and Stop a training session.
- **Live Dashboard**: 
  - **Initial Metrics (MVP)**: Display large, clean, easy-to-read numbers for Elapsed Time, Speed, and Heart Rate.
  - **Extensibility**: The UI layout (e.g., a dynamic grid system) and the underlying State (Zustand store) must be designed to easily accept and render new data points (e.g., Power, Cadence, Elevation) in the future without major refactoring.

### 2.4. Data Storage, History & Sync
- **Local Storage**: Save completed sessions locally on the mobile device (offline-first).
- **Future-Proof Architecture**: The database schema and authentication flows must be designed from day one to support future remote API synchronization (e.g., storing a `synced_at` timestamp or `remote_id`) and Single Sign-On (SSO) capabilities like Google Login, even if unused in the MVP.
- **History View**: Browse past sessions and view summary statistics.
- **Data Management**: Delete unwanted or test sessions.
- **Manual Synchronization**: Provide buttons to trigger upload of the combined workout data to Strava and Apple Fitness.

## 3. System Behaviors & Edge Cases
### 3.1. Background Processing
- Like the native Apple Fitness app, the application must continue to actively record the training session, maintain Bluetooth connections, and sync data when the app is backgrounded or the screen is locked. 

### 3.2. Sync Frequency & Reconnection
- **Capture Rate**: Data should be captured and synchronized into the `TrainingDataPoint` array at a frequency of **1 Hz (Once per second)**. Since metrics like Time, Distance, and Speed come directly from the external devices, the app's primary role is an aggregator, not an accumulator.
- **Connection Drops**: If the Bike drops connection, the app should continue the elapsed time counter (if supported by Watch) and show a "Reconnecting..." status, cleanly resuming the data stream when found.

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

## 5. Project Roadmap / Phases
- **Phase 1: Project Foundation & BLE Core** (includes CI pipeline setup)
- **Phase 2: Core Training Loop & Dashboard**
- **Phase 3: Watch Integration & Data Merging**
- **Phase 4: History & External Sync**
