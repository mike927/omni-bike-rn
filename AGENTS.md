# Agent Instructions

This file contains the always-on instructions for agents working in this repository.

## Project Context

Omni Bike is an iOS indoor cycling companion app. It connects to a BLE stationary bike and optional HR sources, records training sessions, and syncs completed workouts to Strava.

### Tech Stack

- **Framework**: Expo SDK 54 (New Architecture enforced) + `expo-router`
- **State**: `zustand`
- **Database**: `expo-sqlite` + `drizzle-orm`
- **BLE**: `react-native-ble-plx`
- **iOS Native**: `react-native-activity-kit` (Live Activities), `react-native-health`

### Key Constraints

- **HR source priority**: Watch HR > BLE chest strap HR > Bike-reported pulse. Resolved at merge time in the MetronomeEngine, not in the UI.
- **1 Hz tick model**: The MetronomeEngine samples all sources at 1 Hz. Higher resolution is unnecessary for the metrics displayed.
- **Gear persistence before DB**: Saved devices use lightweight key-value storage. The full SQLite schema is introduced only when session recording needs it.
- **Offline-first**: All session data persists locally. Network failures never block the training flow. Uploads happen post-workout and can be retried.

## Core Sources

Read these in this order before feature work:

1. `plan.md`
2. This `AGENTS.md` file
3. Relevant files under `ai/skills/*/SKILL.md`

`plan.md` is the single source of truth for project scope and progress.

When a task depends on vendor-specific behavior, specifications, or hardware setup details, check `docs/README.md` and the relevant files under `docs/vendor/` for trusted local reference material before relying on memory or third-party summaries.

## Task States In `plan.md`

Use these task states consistently:

- `[ ]` not started
- `[~]` in progress
- `[?]` blocked or needs clarification
- `[R]` implemented and in review or waiting for approval
- `[x]` completed and approved
- `[-]` intentionally skipped or deferred

When using `[?]` or `[-]`, include a short reason in the same task line.

## Branch Rules

- Never work directly on `main`.
- Create a branch before making changes.
- Use common branch prefixes:
  - `feature/*`
  - `bugfix/*`
  - `hotfix/*`

Examples:

- `feature/ble-metronome-engine`
- `bugfix/ftms-status-parser`

## Commit Rules

- Use Conventional Commits.
- Make focused commits per meaningful sub-task, not one large commit at the end.

Examples:

- `feat: add BLE metronome engine`
- `fix: correct FTMS machine status parsing`
- `docs: update project progress in plan`

## Coding Conventions

### TypeScript

- Strict mode is enforced. `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch` are on.
- Never use `as any`. Use the actual schema or type returned by a given service.
- Use `type` imports for type-only values. Enforced by ESLint (`consistent-type-imports`).
- Prefer `interface` for contracts and public API shapes. Use `type` for unions, intersections, and utility types.
- Interfaces and type aliases use `PascalCase`. Enum members use `UPPER_CASE` or `PascalCase`.
- Do not declare reusable interfaces or type aliases inside implementation files such as adapters, hooks, screens, or components. Put them in a dedicated sibling file, contract file, or `src/types/` module and import them where needed.

### Architecture

- Use the adapter pattern for external integrations. Define a contract interface (e.g., `BikeAdapter`, `HrAdapter`) and implement it per device or provider.
- Feature logic lives in `src/features/<domain>/`. Service and transport logic lives in `src/services/<domain>/`.
- Hooks are the public API of a feature. They live in `src/features/<domain>/hooks/`.
- Parsers are pure functions that live in `src/services/<domain>/parsers/`.
- Keep layers directional: features → services → parsers. Never import upward.

### Testing

- Use Jest. Test files live in `__tests__/` directories next to the source they test.
- Name test files `<Module>.test.ts`.
- Mock external dependencies (e.g., `bleClient`) at the module level using `jest.mock()`.
- Use `describe` blocks per method or behavior. Use `it` for individual cases.

### Style

- Use tagged logging: `console.error('[ClassName] message')`.
- Use `unknown` for caught errors, not `any`. Narrow with `instanceof Error`.
- Prefer `const` and `prefer-const` is enforced.
- Prettier is integrated via ESLint (120 char width, single quotes, trailing commas).

## Feature Workflow

### 0. Start From The Plan

- Open `plan.md`.
- Find the current section.
- Find the next relevant task in that section.
- Understand current progress before changing code.

### 1. Create A Branch

- Create the feature, bugfix, or hotfix branch first.
- When active implementation starts, update the relevant plan item to `[~]`.

### 2. Clarify Business Requirements And Prepare A Detailed Plan

- Ask questions only when the missing detail is a business or product decision.
- Do not ask questions that can be answered from the repository.
- Before implementation, prepare a detailed plan in Plan Mode based on the relevant raw task in `plan.md`.
- The detailed plan must be specific enough to execute without further design decisions during implementation.
- The detailed plan must be shown to the user and explicitly accepted before implementation starts.
- Technical implementation choices are left to the agent unless the detailed plan exposes a product or business tradeoff that requires user input.
- If work is blocked on a business decision, update the plan item to `[?]` with a short reason.

### 3. Implement Autonomously

- Break the work into small, meaningful sub-tasks.
- Implement fully, not partially.
- Keep commits focused.

### 4. Run Internal Review

- After implementation, perform an internal review with another agent when available.
- The review should focus on bugs, regressions, missing tests, and architecture risks.

### 5. Review Loop

- Address review findings with the main implementation agent.
- For each review point, either:
  - apply a fix, or
  - explicitly decide that the suggestion is not needed and leave it intentionally unchanged.
- Repeat the review/fix loop up to 3 times.
- Stop earlier if the review is already clean.
- If a review file under `ai/reviews/` is removed, that means every point in that file has already been touched: fixed, acknowledged, or intentionally skipped. Do not remove a review file while any point still needs action or a decision.

### 6. Manual Human Testing

- Before opening a Pull Request, the agent MUST pause and ask the human to manually test the changes on their device/simulator.
- Along with the testing request, provide a concise summary of what was implemented and how the change affects the user experience or behavior.
- Provide clear, step-by-step instructions on how the human can test the new functionality.
- Wait for the human's feedback. Address any issues they find.
- Only proceed to the next step once the human explicitly approves the manual test.
- When implementation is complete and approved locally, update the plan item to `[R]`.

### 7. Open A Pull Request

- If GitHub access is available, open a pull request with a concise summary.
- If GitHub access is not available, prepare the pull request summary for a human to open manually.
- While the pull request is open and waiting for review, keep the related plan item at `[R]`.
- Include:
  - what changed
  - why it changed
  - what was validated

### 8. Update The Plan After Approval

- Only mark work as `[x]` after approval.
- Use `[-]` only when work is intentionally skipped or deferred, with a short reason.
- Keep `plan.md` aligned with accepted progress, not only local code state.
- Record the approval update in a separate small commit, not inside the original implementation commit.

Example:

- `docs: mark harness refactor as approved in plan`

### 9. Human Merge

- Merge is done by a human.
- After merge, switch back to `main`.
- Start the next task from `plan.md`.

## Validation

Use normal project commands:

```bash
npm run lint
npm run typecheck
npm test -- --ci --runInBand
npm run ci:gate
npm run build:smoke
```

## Skills

Use a skill when the task clearly matches that domain.

Available skills:

- `ai/skills/architecture/SKILL.md` for boundaries, ownership, and structure
- `ai/skills/ble-hardware/SKILL.md` for BLE, FTMS, bike devices, or heart-rate work
- `ai/skills/expo-ui/SKILL.md` for Expo Router UI, navigation, styling, and components
- `ai/skills/expo-upgrade/SKILL.md` for Expo SDK upgrades and dependency migrations
- `ai/skills/ios-native/SKILL.md` for iOS-specific behavior
- `ai/skills/quality-review/SKILL.md` for internal review and quality checks
- `ai/skills/react-native-perf/SKILL.md` for performance optimization, profiling, and bundle size

### Adding A New Skill

1. Create a folder at `ai/skills/<skill-name>/`.
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`).
3. Write domain-specific content: context, key files, patterns, known issues.
4. Reference it from this section.

Skills are optional helpers. They support this file, not replace it.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown.

If a specific AI tool requires its own config file (e.g., `.gemini/settings.json`, `CLAUDE.md`, `.cursor/rules`), that file should contain **only provider configuration** (model selection, context settings, etc.). Never duplicate instructions from `AGENTS.md` or skills into provider config files.
