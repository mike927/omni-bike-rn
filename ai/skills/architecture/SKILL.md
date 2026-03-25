---
name: architecture
description: Use this skill for architecture analysis, system boundaries, state ownership, and technical direction in this repo.
---
# Architecture

Use this skill when the task is about structure, boundaries, ownership, or technical direction.

## Folder Structure

```text
src/
  features/          ← domain logic, grouped by feature
    devices/         ← BLE scanning, device selection
      hooks/         ← public feature API (useBleScanner, useBikeConnection)
    history/         ← (planned) session history
    training/        ← (planned) live training session
  services/          ← transport and infrastructure
    ble/             ← BLE client, adapters, parsers
      parsers/       ← pure parsing functions (ftmsParser)
      __tests__/     ← unit tests for adapters
    api/             ← (planned) external API integrations
    db/              ← (planned) local database (Drizzle + expo-sqlite)
    health/          ← (planned) Apple Health integration
    watch/           ← (planned) WatchConnectivity
  store/             ← Zustand stores (deviceConnectionStore, trainingSessionStore)
  types/             ← shared type definitions
  ui/                ← shared UI components
  utils/             ← shared utility functions
```

## Adapter Pattern

External integrations use a contract interface + concrete implementation:

- `BikeAdapter` — contract for bike trainers (connect, disconnect, subscribe)
- `HrAdapter` — contract for heart-rate monitors
- `ZiproRaveAdapter` — Zipro Rave implementation of `BikeAdapter`
- `StandardHrAdapter` — generic BLE HR implementation of `HrAdapter`

New devices get a new adapter class, not changes to existing ones.

## State Ownership (Planned)

- Zustand store(s) will own training session state.
- The Metronome Engine (1 Hz timer) will snapshot Zustand state.
- Hooks expose store state to UI via selectors.
- BLE adapters push data into the store, they do not own state.

## Key Design Decisions

- **Expo SDK 54 + New Architecture (JSI)**: Enables synchronous BLE reads without bridge hops.
- **expo-router**: File-based routing under `app/`.
- **No barrel exports**: Import directly from the module file.
- **Hooks as public API**: Feature logic is only consumed through hooks, never by importing services directly from UI.
- **Dedicated type modules**: Reusable interfaces and type aliases belong in a dedicated type/contract file, not inside adapter, hook, screen, or component implementation files.

## See Also

- `AGENTS.md` § Coding Conventions for layer rules, import direction, and naming conventions.
