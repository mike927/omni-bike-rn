# Omni Bike - Technical Architecture

## 1. Project Structure (Domain-Driven)
To maintain Clean Code and strong Separation of Concerns (SoC), this project follows a Domain-Driven / Feature-Based folder structure. 
Code is grouped by *what it does* (e.g., `features/training`), not strictly by *what it is* (e.g., all `components/` in one massive folder).

### Base Directory: `/src`
*(Note: Expo Router places UI screens in `/app`, but all business logic lives in `/src`)*

- `/app`: **(UI / Routing Only)** Expo Router file-based navigation (e.g., `/app/index.tsx`, `/app/(tabs)/history.tsx`). These files ONLY handle layout and pass data to Feature Components.
- `/src/features`: **(The Core)** Isolated modules for specific app domains.
  - `/training`: Contains components (`Dashboard.tsx`), hooks (`useTrainingSession.ts`), and localized helpers purely for the active training session.
  - `/history`: Contains components (`SessionList.tsx`) for browsing past workouts.
- `/src/store`: **(Global State)** Zustand stores (e.g., `useTrainingStore.ts`). This is the "Metronome Engine".
- `/src/services`: **(Infrastructure)** Code that speaks to the outside world.
  - `/ble`: Bluetooth adapters and parsers (e.g., `ZiproAdapter.ts`).
  - `/health`: Apple HealthKit integrations.
  - `/db`: Drizzle ORM schemas, migrations, and repository queries (e.g., `schema.ts`, `SessionRepo.ts`).
  - `/api`: Strava OAuth and API sync.
- `/src/types`: **(Strong Typing)** Global TypeScript definitions and shared enums (e.g., `Training.types.ts`). Note: Feature-specific types should stay inside their respective `/src/features/<name>/` folder.
- `/src/ui`: **(Design System)** Dumb, highly reusable generic UI components (e.g., `Button.tsx`, `Card.tsx`, `Typography.tsx`). These contain zero business logic.
- `/src/utils`: Pure, stateless helper functions (e.g., `mathHelpers.ts`, `dateFormatter.ts`).

---

## 2. Core Principles
1. **Clean Architecture**: Strong Separation of Concerns (SoC) between the UI layer, Business Logic (State/Hooks), and External Services (BLE, HealthKit, Storage).
2. **Strong Typing (TypeScript)**: Enforce strict typings across the app. All Interfaces, Types, and Enums must be extracted into their own dedicated files (e.g., `types/`, or `<Feature>.types.ts`) and never inline within components or services. Strictly avoid type casting (`as`); never use `as any`. Always use types provided by external packages. If unavailable, define them explicitly. Use modern TS features like `satisfies` and custom type guards (`is`) to ensure type safety without forcing casts.
3. **No Unnecessary Boilerplate**: Do not add JSDoc type annotations (e.g., `/** @type {import(...)} */`) in plain `.js` config files or any other redundant scaffolding that adds no real value. Keep config files minimal and clean.
4. **Automated Testing**: Essential business logic and infrastructure services MUST be covered by automated tests.
  - **Unit Tests (`jest`)**: All parsers (e.g., extracting numbers from BLE byte arrays), state machine reducers, and data aggregation logic must have high test coverage. 
  - **Mocking**: External hardware and Native Modules MUST be mocked at the adapter boundary so business logic can be tested on a standard Node CI environment without a physical device.
5. **Standardization**: Prefer official or widely adopted, stable React Native and Expo libraries over custom implementations.
6. **Extensibility**: Design hardware interfaces (Bike, Watch) using the Adapter pattern, making it easy to swap or add new hardware support without changing the core training logic.
7. **Definition of Done**: Every change session or new feature must conclude with **zero linter errors** (`eslint`), **all unit tests passing** (`jest`), and **zero TypeScript compiler errors** (`tsc`). Code quality is non-negotiable.
8. **Agent Feature Completion Pipeline**: When the developer agent claims a feature is complete, it MUST follow this pipeline in order:
   1. **CI Gate**: Run all CI checks locally (`npm run lint`, `npm run typecheck`, `npm test`). All must pass with zero errors before proceeding.
   2. **Internal Code Review Loop**: Delegate a full code review to a separate agent (acting as code reviewer). The reviewer analyzes all changes and produces comments/suggestions. The developer agent then analyzes the feedback, applies the relevant changes, and re-runs the CI Gate. This loop repeats until both the review is clean and all CI checks pass.
   3. **Open GitHub Pull Request**: Only after the internal review loop is complete with all changes applied and CI passing, the agent pushes the branch and opens a GitHub PR with a structured format (Title, Description, Testing Checklist).
9. **Human Pull Request Review**: If the human user leaves comments on the GitHub Pull Request, they should paste the GitHub PR URL or summarize the feedback back into the chat. The development agent will then check out the feature branch, analyze the human feedback, apply the requested changes, re-run the full CI Gate (linter, types, tests), and push the updated branch to automatically update the PR.

## 2. Technology Stack
- **Framework**: Expo (Managed Workflow with Custom Dev Clients due to native BLE/HealthKit requirements). `expo-router` for file-based navigation.
- **Language**: TypeScript (strict mode enabled for high reliability).
- **Code Quality**: `eslint` (with Expo/RN recommended rules and strict typing rules) and `prettier` for automatic formatting.
- **State Management**: `zustand` (excellent for high-frequency updates like live sensor data without triggering unnecessary global React renders).
- **Local Storage / DB**: `expo-sqlite` combined with `drizzle-orm` (type-safe, familiar for Node.js developers, fast offline storage).
- **Bluetooth (BLE)**: `react-native-ble-plx` (the industry standard for RN Bluetooth).
- **Health Data (Apple HealthKit)**: `react-native-health` (proven library for interacting with Apple Health).

## 3. Architecture Layers

### 3.1. UI Layer (`/app`, `/components`)
- **Responsibility**: Purely presentational. Subscribes to the global Zustand store to render realtime metrics (Power, HR, Speed).
- **Rules**: Contains NO business logic regarding *how* to connect to a bike or *how* to save a workout. Only triggers actions (e.g., `startWorkout()`, `connectBike()`).

### 3.2. Business Logic & State Layer (`/store`)
- **Responsibility**: The heart of the application.
- **The "Metronome" Engine**: 
  - A Zustand store (e.g., `useTrainingStore`) that holds the *current* real-time state (`currentPower`, `currentHr`).
  - Contains the logic that ticks every 1 second, takes a snapshot of the current state, appends it to an in-memory array (`currentSessionData`), and controls the Training State Machine (Idle -> Active -> Paused -> Finished).

### 3.3. Infrastructure Layer (`/services`)
This layer handles all direct communication with the outside world. It *pushes* data into the Zustand store.

#### A. Hardware Adapters (`/services/ble`)
- **`BleManager`**: A singleton wrapping `react-native-ble-plx`. Handles scanning, connection pooling, and disconnections.
- **`BikeAdapter` Interface**: An abstract interface defining what a bike *should* do (e.g., `subscribeToMetrics(callback)`).
- **`ZiproRaveAdapter`**: Implements the `BikeAdapter`. Knows exactly which UUIDs to listen to and how to parse the byte arrays specifically for the Zipro Rave. When it parses a power value, it calls `useTrainingStore.getState().setBikeMetrics({ power })`.

#### B. Health Adapters (`/services/health`)
- Wraps `react-native-health` and/or the companion WatchOS app bridging.
- Pushes HR data: `useTrainingStore.getState().setWatchMetrics({ hr })`.

#### C. Storage Repository (`/services/db`)
- Wraps Drizzle ORM and SQLite.
- Exposes clean methods like `saveTrainingSession(session)` and `getHistory()`. Does not know anything about React or Bluetooth.

#### D. Sync Services (`/services/api`)
- Handles the OAuth flows and API requests to Strava.
- Handles exporting data points back into Apple Fitness via HealthKit.

## 4. Git Workflow & Conventions
We follow a lightweight **Git Flow** strategy to ensure the `main` branch is always stable, deployable, and clearly tracks feature development.

### 4.1. Branching Strategy
- **`main`**: The single source of truth. Must always compile with zero linter/TypeScript errors and passing tests.
- **`feature/<feature-name>`**: For all new features (e.g., `feature/ble-scanner`). Branched from `main`. **Agent requirement:** After development and AI code review are complete, the agent must push the branch to GitHub and seamlessly open a Pull Request. The PR must have a structured format (Title, Description, Testing Checklist). The human user will be the one to manually merge the PR into `main`.
- **`bugfix/<bug-name>`**: For fixing non-critical bugs found during development (e.g., `bugfix/hr-sync-crash`). Follows the same PR reporting flow.
- **`hotfix/<issue>`**: For urgent fixes directly targeting production/`main`.

### 4.2. Commit Messages (Conventional Commits)
All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This provides a clean history and allows for automated changelogs.
- `feat: <description>` (e.g., `feat: integrate ble scanner for zipro`)
- `fix: <description>` (e.g., `fix: resolve crash when watch disconnects`)
- `refactor: <description>` (e.g., `refactor: extract bluetooth parsing to adapter pattern`)
- `docs: <description>` (e.g., `docs: update roadmap in plan.md`)
- `test: <description>` (e.g., `test: add unit tests for hr aggregation logic`)
- `chore: <description>` (e.g., `chore: update dependencies`, `chore: initialize react native app`)

## 5. CI/CD Pipeline & Distribution
To maintain our "Definition of Done," we use **GitHub Actions** paired with **Expo Application Services (EAS)** for continuous integration and deployment.

### 5.1. Pull Request Integrity (GitHub Actions)
Every Pull Request against `main` automatically triggers a GitHub Workflow that runs:
1. `eslint` to ensure code style compliance.
2. `tsc` (TypeScript compiler) to ensure zero type errors.
3. `jest` to run all unit tests.
*A PR cannot be merged into `main` if any of these checks fail.*

### 5.2. Build & Distribution (Expo EAS)
We use EAS Build rather than local Xcode/Android Studio for all application compilation.
- **Development Builds (`eas build --profile development`)**: Used to create custom Dev Clients for our local testing devices that include the native BLE and HealthKit bridging code.
- **OTA Updates (`eas update`)**: For Javascript/TypeScript UI or Logic bug fixes, code is pushed instantly "Over-The-Air" directly to the installed app, avoiding the App Store review process.
- **Production Builds (`eas build --profile production`)**: The finalized `.ipa` or `.aab` binary used for TestFlight or App Store distribution.
