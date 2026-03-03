---
name: architecture
description: Use this skill to understand the Metronome Engine, the 1Hz data flow, and Expo SDK 54 New Architecture constraints.
---
## The Metronome Engine
* **Synchronized Sampling:** A 1Hz timer takes a snapshot of the Unified State, creating a `TrainingDataPoint`.
* **Performance:** Must leverage JSI (JavaScript Interface) to avoid asynchronous bridge serialization costs during high-frequency BLE reads.

## Folder Structure
* `/app`: Expo Router navigation.
* `/src/features`: Core domains (`/training`, `/history`).
* `/src/store`: Global Zustand stores.
* `/src/services`: Adapters (`/ble`, `/db`).
