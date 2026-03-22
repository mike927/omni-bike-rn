# Omni Bike - Project Plan

See `PROJECT.md` for business requirements, functional requirements, and technology stack.

## Task State Legend

- `[ ]` not started
- `[~]` in progress
- `[?]` blocked or needs clarification
- `[R]` implemented and in review / waiting for approval
- `[x]` completed and approved
- `[-]` intentionally skipped or deferred

## Phase 1: Foundation & BLE Core

- [x] Expo project scaffold, TypeScript, ESLint, Prettier (Enforce New Architecture/JSI)
- [x] CI pipeline (GitHub Actions: lint, typecheck, test)
- [x] Domain-driven folder structure (`/src/features`, `/src/services`, etc.)
- [x] BLE scanning & connection to Zipro Rave
- [x] Raw metric parsing (FTMS Indoor Bike Data + Machine Status)
- [x] BLE HR monitor support (standard HR Service `0x180D`)
- [x] Add comprehensive unit tests covering various test cases

## Phase 2: Training Loop & Dashboard

- [R] Zustand store + Metronome engine (1 Hz sampling, JSI optimized)
- [ ] Training state machine (Idle → Active → Paused → Finished)
- [ ] Auto-pause/resume via FTMS Machine Status (pause when bike detects no pedaling)
- [ ] Live Dashboard UI (Time, Speed, HR, Power, Calories - Portrait & Landscape)
- [ ] Live Activities & Dynamic Island integration (`react-native-activity-kit`)
- [ ] Local DB schema + session persistence (Drizzle + expo-sqlite)
- [ ] Add comprehensive unit tests covering various test cases

## Phase 3: Watch Integration

- [ ] Native WatchOS companion app (SwiftUI + HealthKit workout session)
- [ ] Real-time HR streaming via WatchConnectivity
- [ ] HR source priority logic (Watch > BLE HR monitor > Bike pulse)
- [ ] Background recording with BLE + Watch
- [ ] Add comprehensive unit tests covering various test cases

## Phase 4: History & External Sync

- [ ] Session history list + detail view with summary statistics
- [ ] Session deletion
- [ ] Strava OAuth + session upload
- [ ] Apple Health export via `react-native-health` (completed sessions only)
- [ ] Raw `.FIT` binary file export generation
- [ ] Add comprehensive unit tests covering various test cases
