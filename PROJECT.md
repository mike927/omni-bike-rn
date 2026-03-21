# Omni Bike

## Business Requirements

- **Core Value Proposition**: Unified indoor cycling view combining stationary bike (BLE) and smartwatch data.
- **Distribution**: iOS-first MVP.
- **Data Portability**: Sync to Strava/Apple Fitness, PLUS raw `.FIT` file export for power users.

## Functional Requirements

### Connectivity & Device Discovery

- **Bike Trainer**: Scan/connect to BLE trainers (Zipro Rave).
- **HR Monitor**: Standard BLE HR Service (`0x180D`).
- **Apple Watch**: Native WatchOS companion app via WatchConnectivity (Phase 3).

### Data Collection & Processing

- **The Metronome Engine (JSI Optimized)**: A central 1Hz timer takes a snapshot of the Unified State. Utilizes React Native's New Architecture (JSI) for synchronous, low-latency BLE reads.
- **HR Priority**: 1. Apple Watch > 2. BLE HR Monitor > 3. Bike Pulse.

### Training Session Management

- **Live Dashboard**: Displays Speed, Time, HR, Power, and Calories. Must support both Portrait and Landscape orientations.
- **Live Activities (Dynamic Island)**: When backgrounded, the app surfaces live metrics to the iOS Lock Screen and Dynamic Island.

### Data Model & Storage

- **Offline-First**: `expo-sqlite` + `drizzle-orm`.
- **Crash Recovery**: Metronome auto-saves snapshots locally. Interrupted sessions can be resumed.

## Technology Stack

- **Framework**: Expo SDK 54 (New Architecture enforced) + `expo-router`
- **State**: `zustand`
- **Database**: `expo-sqlite` + `drizzle-orm`
- **BLE**: `react-native-ble-plx`
- **iOS Native**: `react-native-activity-kit` (Live Activities), `react-native-health`
