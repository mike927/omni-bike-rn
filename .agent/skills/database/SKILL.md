---
name: database
description: Use this skill for local storage schemas, Drizzle ORM configuration, and data sync requirements.
---
## Storage & ORM
* Use `expo-sqlite` and `drizzle-orm` for offline-first local storage.
* **Crash Recovery:** Metronome must auto-save `TrainingDataPoint` snapshots locally in real-time or small batches.

## Core Schemas
* **TrainingSession:** `id`, `title`, `startedAt`, `endedAt`, `duration`, `status`, `avgSpeed`, `maxSpeed`, `avgHr`, `maxHr`, `totalDistance`, `totalCalories`.
* **TrainingDataPoint:** `id`, `sessionId`, `timestamp`, `elapsedSeconds`, `speed`, `power`, `cadence`, `heartRate`, `distance`, `calories`.
