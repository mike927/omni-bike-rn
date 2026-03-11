# Omni Bike - Project Plan (Enhanced)

## 1. Business Requirements
- **Core Value Proposition**: Unified indoor cycling view combining stationary bike (BLE) and smartwatch data.
- **Distribution**: iOS-first MVP.
- **Data Portability**: Sync to Strava/Apple Fitness, PLUS raw `.FIT` file export for power users.

## 2. Functional Requirements
### 2.1. Connectivity & Device Discovery
- **Bike Trainer**: Scan/connect to BLE trainers (Zipro Rave).
- **HR Monitor**: Standard BLE HR Service (`0x180D`).
- **Apple Watch**: Native WatchOS companion app via WatchConnectivity (Phase 3).

### 2.2. Data Collection & Processing
- **The Metronome Engine (JSI Optimized)**: A central 1Hz timer takes a snapshot of the Unified State. Utilizes React Native's New Architecture (JSI) for synchronous, low-latency BLE reads.
- **HR Priority**: 1. Apple Watch > 2. BLE HR Monitor > 3. Bike Pulse.

### 2.3. Training Session Management
- **Live Dashboard**: Displays Speed, Time, HR, Power, and Calories. Must support both Portrait and Landscape orientations.
- **Live Activities (Dynamic Island)**: When backgrounded, the app surfaces live metrics to the iOS Lock Screen and Dynamic Island.

### 2.4. Data Model & Storage
- **Offline-First**: `expo-sqlite` + `drizzle-orm`.
- **Crash Recovery**: Metronome auto-saves snapshots locally. Interrupted sessions can be resumed.

## 3. Technology Stack (2026 State of the Art)
- **Framework**: Expo SDK 54 (New Architecture enforced) + `expo-router`
- **State**: `zustand`
- **Database**: `expo-sqlite` + `drizzle-orm`
- **BLE**: `react-native-ble-plx`
- **iOS Native**: `react-native-activity-kit` (Live Activities), `react-native-health`

## 4. Roadmap / Phases

### Phase 1: Foundation & BLE Core
- [x] Expo project scaffold, TypeScript, ESLint, Prettier (Enforce New Architecture/JSI)
- [x] CI pipeline (GitHub Actions: lint, typecheck, test)
- [x] Domain-driven folder structure (`/src/features`, `/src/services`, etc.)
- [x] BLE scanning & connection to Zipro Rave
- [ ] Raw metric parsing (confirm available console metrics over BLE)
- [x] BLE HR monitor support (standard HR Service `0x180D`)
- [x] Add comprehensive unit tests covering various test cases

### Phase 2: Training Loop & Dashboard
- [ ] Zustand store + Metronome engine (1 Hz sampling, JSI optimized)
- [ ] Training state machine (Idle → Active → Paused → Finished)
- [ ] Live Dashboard UI (Time, Speed, HR, Power, Calories - Portrait & Landscape)
- [ ] Live Activities & Dynamic Island integration (`react-native-activity-kit`)
- [ ] Local DB schema + session persistence (Drizzle + expo-sqlite)
- [ ] Add comprehensive unit tests covering various test cases

### Phase 3: Watch Integration
- [ ] Native WatchOS companion app (SwiftUI + HealthKit workout session)
- [ ] Real-time HR streaming via WatchConnectivity
- [ ] HR source priority logic (Watch > BLE HR monitor > Bike pulse)
- [ ] Background recording with BLE + Watch
- [ ] Add comprehensive unit tests covering various test cases

### Phase 4: History & External Sync
- [ ] Session history list + detail view with summary statistics
- [ ] Session deletion
- [ ] Strava OAuth + session upload
- [ ] Apple Health export via `react-native-health` (completed sessions only)
- [ ] Raw `.FIT` binary file export generation
- [ ] Add comprehensive unit tests covering various test cases
