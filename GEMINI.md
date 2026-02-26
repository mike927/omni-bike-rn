# Omni Bike - Technical Architecture

## 1. Project Structure (Domain-Driven)

This project follows a domain-driven folder structure: code is grouped by *what it does* (e.g., `features/training`), not by *what it is*.

### Base Directory: `/src`
*(Expo Router places screens in `/app`, but all business logic lives in `/src`)*

- `/app`: **(Routing Only)** Expo Router file-based navigation. These files handle layout and delegate to Feature Components.
- `/src/features`: **(Core Domains)** Isolated modules per app domain.
  - `/training`: Components, hooks, and helpers for the active training session.
  - `/history`: Components for browsing past workouts.
- `/src/store`: **(Global State)** Zustand stores — the "Metronome Engine" (see §3).
- `/src/services`: **(Infrastructure)** External communication adapters.
  - `/ble`: Bluetooth adapters and parsers (bike trainers + HR monitors).
  - `/watch`: WatchConnectivity bridge for WatchOS companion app (Phase 3).
  - `/health`: Apple HealthKit export for completed sessions (Phase 4).
  - `/db`: Drizzle ORM schemas, migrations, and repositories.
  - `/api`: Strava OAuth and sync.
- `/src/types`: **(Shared Types)** Global TypeScript definitions and enums. Feature-specific types stay inside `/src/features/<name>/`.
- `/src/ui`: **(Design System)** Reusable, stateless UI primitives (Button, Card, Typography). Zero business logic.
- `/src/utils`: Pure, stateless helper functions.

---

## 2. Core Principles

1. **Clean Architecture**: Strict separation between UI, Business Logic (State/Hooks), and Infrastructure (BLE, HealthKit, Storage). Each layer has a single direction of dependency.

2. **Strong Typing (TypeScript)**:
   - All interfaces, types, and enums must live in dedicated type files — never inline.
   - Never use `as` or `as any`. Use `satisfies`, type guards (`is`), and types from external packages.

3. **No Unnecessary Boilerplate**: No JSDoc type annotations in `.js` config files. Keep config files minimal.

4. **Automated Testing**:
   - **Unit tests (`jest`)**: High coverage for parsers, state machine reducers, and data aggregation.
   - **Mocking**: External hardware and native modules mocked at the adapter boundary for CI-friendly testing.

5. **Standardization**: Prefer official or widely adopted Expo/RN libraries over custom implementations.

6. **Extensibility**: Hardware interfaces (Bike, Watch) use the Adapter pattern — new hardware ≠ core logic changes.

7. **Graceful Error Handling**: BLE disconnections, permission denials, and network failures must surface user-facing feedback. Never swallow errors silently.

8. **Naming Conventions**:
   - `PascalCase` for components and types (`BikeAdapter.ts`, `SessionCard.tsx`).
   - `camelCase` for hooks, functions, and variables (`useTrainingSession`, `formatDuration`).
   - `UPPER_SNAKE_CASE` for constants and enum members.

9. **Dependency Policy**: Prefer existing dependencies. Adding a new package requires justification (no alternative exists, or it provides significant value over a custom solution).

10. **Definition of Done (CI Gate)**: Every change must conclude with **zero errors** from all three checks:
    ```
    npm run lint && npm run typecheck && npm test
    ```
    This gate is referenced throughout the workflow below as "CI Gate."

---

## 3. Architecture — Data Flow

Beyond the folder layout in §1, the key architectural concept is the **data flow**:

```
BLE Bike Adapter  ─┐
BLE HR Monitor    ─┼─→ pushes data → Zustand Store ← subscribes ← UI
Watch (Phase 3)   ─┘
```

### The "Metronome Engine" (`/src/store`)
- The `useTrainingStore` holds real-time state (`currentPower`, `currentHr`).
- A 1-second tick takes a snapshot, appends it to `currentSessionData[]`, and drives the Training State Machine: `Idle → Active → Paused → Finished`.

### Adapter Pattern (`/src/services/ble`)
- `BikeAdapter` interface defines what any bike must do (e.g., `subscribeToMetrics(callback)`).
- Concrete adapters (e.g., `ZiproRaveAdapter`) implement it with device-specific UUIDs and byte-array parsing, then push into the store.
- `HrAdapter` interface handles any BLE Heart Rate peripheral via the standard HR Service (`0x180D`).
- In Phase 3, a `WatchHrAdapter` wraps WatchConnectivity to provide the same interface, enabling seamless HR source switching.

### HR Source Priority
- When multiple HR sources are connected, the highest-priority source is used: **Watch > BLE HR Monitor > Bike Pulse**.

### Storage & Sync (`/src/services/db`, `/src/services/api`)
- Repository pattern via Drizzle ORM — no knowledge of React or BLE.
- Strava sync handles OAuth/API upload of completed sessions.
- HealthKit export (`react-native-health`) writes completed sessions to Apple Health — **not used for live HR**.

---

## 4. Agent Workflow

### 4.1. Feature Completion Pipeline
When the agent claims a feature is complete, it MUST follow this pipeline in order:

1. **CI Gate**: Run `npm run lint`, `npm run typecheck`, `npm test`. All must pass.
2. **Internal Code Review Loop**: Delegate a review to a separate agent. Apply feedback, re-run CI Gate. Repeat until clean.
3. **Open GitHub PR**: Push the branch and open a PR with structured format (Title, Description, Testing Checklist). The human merges.

### 4.2. Human PR Review
When the user shares PR feedback, the agent checks out the branch, applies changes, re-runs CI Gate, and pushes.

---

## 5. Git Conventions

### 5.1. Branching Strategy
- **`main`**: Always stable. Must pass CI Gate. **Direct commits to `main` are STRICTLY FORBIDDEN.** All changes must go through a PR.
  - 🚨 **CRITICAL AGENT INSTRUCTION**: **NEVER commit directly to `main`.** Whenever the current branch is `main` and you want to commit changes, you MUST use `git checkout -b <branch-name>` to create a new feature branch FIRST, and then commit and push.
- **`feature/<name>`**: New features. Follows the Agent Feature Completion Pipeline (§4.1).
- **`bugfix/<name>`**: Non-critical fixes. Same pipeline.
- **`hotfix/<issue>`**: Urgent fixes. Must still be branched and PR'd.

### 5.2. Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/). Common prefixes: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

---

## 6. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo (Custom Dev Client) + `expo-router` |
| Language | TypeScript (strict mode) |
| Code Quality | `eslint` + `prettier` |
| State | `zustand` |
| Database | `expo-sqlite` + `drizzle-orm` |
| BLE (Bike + HR) | `react-native-ble-plx` |
| Watch (Phase 3) | Native WatchOS + WatchConnectivity |
| HealthKit (export) | `react-native-health` |

---

## 7. CI/CD & Distribution

### 7.1. Pull Request Checks (GitHub Actions)
Every PR against `main` triggers the CI Gate (`eslint`, `tsc`, `jest`). A failing check blocks merge.

### 7.2. Builds (Expo EAS)
- **Development**: `eas build --profile development` — custom Dev Clients with native BLE/HealthKit.
- **OTA Updates**: `eas update` — instant JS-only patches, no App Store review.
- **Production**: `eas build --profile production` — final `.ipa`/`.aab` for distribution.
