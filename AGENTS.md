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
3. `git branch --show-current`
4. `git worktree list`
5. Relevant files under `ai/skills/*/SKILL.md`
6. When the user asks for a specific procedure (review, PR, validate, status), load the matching `ai/commands/*/COMMAND.md`
8. When the task involves vendor-specific behavior or hardware, check `docs/` for trusted reference material

`plan.md` is the single source of truth for project scope and progress.
`branch-slug` means the branch name with `/` replaced by `-`.

## Task States In `plan.md`

Use these task states consistently:

- `[ ]` not started
- `[~]` in progress
- `[?]` blocked or needs clarification
- `[R]` implemented locally and ready for PR (or internal review)
- `[x]` in PR, waiting for merge, or already merged
- `[-]` intentionally skipped or deferred

When using `[?]` or `[-]`, include a short reason in the same task line.

## Branching And Workspace Rules

- Never commit changes directly to `main`. The `main` branch is a coordination and read-only workspace.
- **In-Place Branching**: You may use standard branches (`git checkout -b <branch>`) directly in the repository root. This is preferred for linear development.
- **Worktree Branching**: You may create a dedicated worktree (`../omni-bike-rn-worktrees/<branch-slug>`) when explicitly requested for parallel isolation.
- Use Conventional Commits prefixes for branch names (e.g., `feat/`, `fix/`, `docs/`, `refactor/`). Determine the prefix automatically based on the task scope.
- Name branches as `<type>/<kebab-case-description>` (e.g., `feat/ble-metronome-engine`).
- `branch-slug` means the exact branch name with `/` replaced by `-`.
- When a feature branch is merged and its explicitly isolated worktree is safely stale, remove the worktree to keep the local filesystem clean.

Examples:

- `feat/ble-metronome-engine`
- `fix/ftms-status-parser`
- `../omni-bike-rn-worktrees/feat-ble-metronome-engine`

## Commit Rules

- Use Conventional Commits.
- Make focused commits per meaningful sub-task, not one large commit at the end.

Examples:

- `feat: add BLE metronome engine`
- `fix: correct FTMS machine status parsing`
- `docs: update project progress in plan`

## Workflow Artifacts

- `ai/local/plans/<branch-slug>.md`: the local implementation plan for the active branch. Create it before implementation. Treat this file as a read-only blueprint once approved; do not update it continuously to track progress unless the fundamental scope changes.
- `ai/local/reviews/<branch-slug>.md`: local internal review findings and follow-up notes for the active branch.
- `ai/local/testing/<branch-slug>.md`: local saved manual testing checklist. Create or update it only when the human explicitly asks for a persistent checklist file.
- Reuse the same `branch-slug` across all branch-scoped AI artifacts.
- These files are intentionally local-only and ignored by git. Do not open PRs just to add, update, or remove them.
- When the worktree is deleted after merge, its `ai/local/` files disappear with it, so no repo cleanup commit is needed for branch runtime state.

## Coding Conventions

### TypeScript

- Strict mode is enforced. `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch` are on.
- Never use `as any`. Use the actual schema or type returned by a given service.
- Use `type` imports for type-only values. Enforced by ESLint (`consistent-type-imports`).
- Prefer `interface` for contracts and public API shapes. Use `type` for unions, intersections, and utility types.
- Interfaces and type aliases use `PascalCase`. Enum members use `UPPER_CASE` or `PascalCase`.
- Do not declare reusable interfaces or type aliases inside implementation files such as adapters, hooks, screens, or components. Put them in a dedicated sibling file, contract file, or `src/types/` module and import them where needed.

- Do not use magic values (inline UUIDs, URLs, numeric constants). Define them as named constants at module scope and reference the constant everywhere. If the same value is needed in multiple files, define it once and import it.

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

### Workflow Pacing and Discipline

- You must execute the workflow strictly and sequentially. Do not spontaneously skip numbered workflow steps.
- Do not chain multiple distinct workflow steps together in a single turn. You must pause at the logical end of your current step, report your progress via a Chat Progress Update, and await explicit human instruction before executing the next numbered phase.
- If a step is logically irrelevant for a given task (e.g., Manual Human Testing for a pure documentation update), you must still output the `**Workflow Progress**` header for that step, formally note that it is being skipped, and provide a super concise reason why. Do not silently skip past it.

### Chat Headers

- For substantive user-facing messages, start with a short header that tells the human what kind of message this is.
- Prefer these headers:
  - `**Workflow Progress**`
  - `**Plan**`
  - `**Question**`
  - `**Feature Summary**`
  - `**Manual Testing**`
  - `**Review**`
  - `**Blocked**`
- Keep headers short, stable, and purpose-based. Do not invent a new header prevent standard labels if they fit.

### Chat Progress Updates

- Use the `**Current Focus**` header only for meaningful progress updates.
- Default to a single `**Current Focus**` update at the start of a work burst.
- Send another one only when there is a real transition: stage change, blocker, need for user input, or a notably long-running task.
- Do not send repeated progress updates for every small loop iteration, quick status check, tightly-coupled follow-up command, or each step inside a commit/push/validate loop.
- *Note:* At session start (Step 1), the explicit `/check-state` snapshot command format takes precedence. Do not stack a `**Current Focus**` update on top of a `/check-state` block.
- If the task does not require every step (e.g., simple debugging), the status message must explicitly reflect the actual active stage instead of implying false sequential progress.

Use this format for all standard stage transitions or turn pauses:

```md
**Current Focus**
- <concise summary>
- <optional concise summary>
- <optional concise summary>
```

- Use 1 to 3 short bullet lines starting with `-`.
- If you are completely blocked, use `**Current Focus**` with a concise blocked summary in the same bullet format.
- Tailor the bullets to the active step or immediate task (for example planning, implementation, validation, review, or testing).
- Keep the bullets short, direct, and non-redundant.
- In most cases, prefer a single bullet.
- Preserve the exact `**Current Focus**` header so the message is always visually distinct and scannable in the chat UI.

### 1. Bootstrap / Resume Context

- If the current branch is not `main`, treat the session as a resume:
  - invoke the `/check-state` command logic to analyze the actual workspace reality
  - continue from the logically implied step based on the status snapshot
  - do not restart planning or implementation from scratch
- If the current branch is `main`, treat the session as a new task and continue to step 2.

### 2. Workspace Ready

- Execute the `/start-feature` command logic.
- Never commit changes directly to `main`.
- If the task is a resume, verify where the current branch exists and continue working there instead of creating a new workspace.

### 3. Detailed Plan Prepared

- If your host environment utilizes dedicated agent operational modes (e.g., a "Planning" vs. "Edit" UI toggle or CLI flag), explicitly ask the human to ensure the correct mode is active before drafting the plan.
- Only ask questions about business/product decisions; do not ask questions that can be answered by reading the repository.
- **Ask product/business questions interactively: always offer 2–4 concrete options per question plus a free-text escape hatch. Use the most interactive mechanism your platform provides (e.g., dedicated UI prompts, tool calls, or simply numbered lists in chat). Never ask open-ended questions when choices can be offered.**
- If work is blocked on a business decision, update the relevant `plan.md` item with `[?]` plus a short reason.
- Before implementation, write a detailed plan to `ai/local/plans/<branch-slug>.md` based on the relevant raw task in `plan.md`. The detailed plan must be specific enough to execute without further design decisions during implementation.

### 4. Detailed Plan Approved

- Share the plan file with the user and wait for explicit approval before writing code. Discuss and iterate on the plan until approved.
- Technical implementation choices are left to the agent unless the detailed plan exposes a product or business tradeoff that requires user input.

### 5. Implementation In Progress

- When active implementation starts, update the relevant `plan.md` item to `[~]`.
- Break the work into small, meaningful sub-tasks.
- Implement fully, not partially.
- Keep commits focused.
- **Do not continuously update** `ai/local/plans/<branch-slug>.md` to check off tasks while coding. Progress is tracked via `git log` and `git status`. Agents will re-sync tracking state natively on-the-fly using the `/check-state` command if context is lost.

### 6. Validation Complete

- Execute the `/validate` command logic.
- Do not move forward to review or testing until validation explicitly passes.

### 7. Internal Review

- Execute the `/review` command logic to deeply analyze your diff for bugs, regressions, missing tests, and architecture risks before asking the human to test.
- Use `/review branch` as the default first pre-test review on the branch.
- Let the `/review` command own review-file creation and cleanup behavior in `ai/local/reviews/<branch-slug>.md`.

### Fix Loop Decision Rules

Use these rules for Internal Review Fix Loop, Manual Testing Fix Loop, and PR Review Fix Loop so the decision logic lives in one place.

- Validation scope:
  - use `/validate quick` for docs, workflow, comments, text-only changes, or narrow non-runtime refactors
  - use `/validate test` for test-only changes
  - use `/validate full` for runtime logic, app behavior, native/config/build changes, routing, persistence, BLE, permissions, or anything user-visible
- Internal review scope:
  - use `/review staged` by default after a small local follow-up fix
  - escalate to `/review branch` when the fix changes architecture, contracts or interfaces, shared flows or shared state, routing, persistence, native behavior, BLE behavior, or could invalidate earlier review conclusions
- Manual retesting:
  - do not require human retesting during Step 8 unless the review-driven fix changes user-visible behavior or invalidates behavior the human will later verify
  - require targeted human retesting during Step 10 or Step 13 when the fix is user-visible, native, risky, or changes a previously tested flow
- A fix loop is clean only when the selected validation passes, no unresolved blocking review findings remain, and any required retest or PR follow-up for that stage is complete

### 8. Internal Review Fix Loop

- If internal review finds issues, fix them before asking the human to test.
- After each review-driven code change, follow the Fix Loop Decision Rules for validation and internal review scope.
- Default to `/review staged` for small incremental follow-up fixes. Escalate to `/review branch` only when the rules above require it.
- Do not proceed to manual testing until the fix loop is clean.
- If internal review is already clean, mark this step complete with a short note such as `no fixes needed`.

### 9. Manual Human Testing

- Before opening a Pull Request, the agent MUST pause and ask the human to manually test the changes on their device or simulator.
- Along with the testing request, provide a concise summary of what was implemented and how the change affects the user experience or behavior.
- Every manual testing request must explicitly say whether the human needs to restart the Metro server, rebuild the app, both, or neither before testing. If no restart or rebuild is needed, say that explicitly.
- Provide the testing checklist directly in the conversation window. Use a short numbered list for the key validation path, and expand it only as much as needed for the current change.
- For follow-up fixes after initial manual testing, provide only the incremental retest steps that matter for the latest change unless the full flow needs to be re-run.
- Do not create or update `ai/local/testing/<branch-slug>.md` unless the human explicitly asks for a saved checklist file.
- Wait for the human's feedback. Address any issues they find.
- Only proceed to the next step once the human explicitly approves the manual test.
- When implementation is complete and approved locally, update the plan item to `[R]`.

### 10. Manual Testing Fix Loop

- If manual testing feedback leads to code changes, do not jump straight to PR.
- After each manual-testing-driven code change, follow the Fix Loop Decision Rules for validation and internal review scope.
- Request targeted manual retesting only for the affected behavior unless the change is provably non-user-visible.
- Stay in this loop until the human explicitly confirms the latest changes.

### 11. PR Open

- Execute the `/open-pr` command logic.
- The `/open-pr` command owns the `plan.md [x]` commit — it marks the task as completed and pushes the commit as part of its final step. No additional plan update is needed after this step.

### 12. PR Review Comments

- Execute the `/address-pr-comments` command logic.
- GitHub review comments are the primary review queue for the branch once the PR is open.
- Only treat a review comment as resolved after the fix is implemented, validated, and pushed.

### 13. PR Review Fix Loop

- If PR review feedback leads to code changes:
  - follow the Fix Loop Decision Rules for validation and internal review scope
  - request targeted manual retesting when the fix changes user-visible behavior, product flow, native behavior, or anything the human previously validated manually
  - prepare updated reply text or direct GitHub replies only after the fix and required revalidation are complete
- Repeat the PR review and fix loop up to 3 times. Stop earlier if the review queue is already clean.

### 14. Ready For Merge

- Use `[-]` only when work is intentionally skipped or deferred, with a short reason.
- Keep `plan.md` aligned with accepted progress, not only local code state.

### 15. Merge And Cleanup

- Execute the `/finish-feature` command logic.
- The command marks `plan.md` as `[x]`, merges the PR via GitHub CLI (merge commit), safety-checks the local workspace, removes the branch or worktree, and returns to `main`.

## Validation

Use normal project commands:

```bash
npm run lint
npm run typecheck
npm test -- --ci --runInBand
npm run build:smoke
```

## Skills

Use a skill when the task clearly matches that domain.

Available skills:

- `ai/skills/architecture/SKILL.md` for boundaries, ownership, and structure
- `ai/skills/ble-hardware/SKILL.md` for BLE, FTMS, bike devices, or heart-rate work
- `ai/skills/drizzle-expo/SKILL.md` for official Drizzle ORM workflow in Expo: schema changes, drizzle-kit generation, bundled migrations, and startup wiring
- `ai/skills/expo-ui/SKILL.md` for Expo Router UI, navigation, styling, and components
- `ai/skills/expo-upgrade/SKILL.md` for Expo SDK upgrades and dependency migrations
- `ai/skills/ios-native/SKILL.md` for iOS-specific behavior
- `ai/skills/quality-review/SKILL.md` for review checklists and quality standards
- `ai/skills/react-native-perf/SKILL.md` for performance optimization, profiling, and bundle size
- `ai/skills/sqlite-persistence/SKILL.md` for Expo SQLite, persistence boundaries, session-recording rules, and repository guidance
- `ai/skills/stitch-design/SKILL.md` for UI design with Google Stitch, MCP integration, and design-to-code conversion

### Adding A New Skill

1. Create a folder at `ai/skills/<skill-name>/`.
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`).
3. Write domain-specific content: context, key files, patterns, known issues.
4. Reference it from this section.

Skills are optional helpers. They support this file, not replace it.

## Commands

Use a command when the task is a specific, repeatable procedure rather than general domain context. Commands are active procedures that complement skills (passive reference).

Available commands:

- `ai/commands/check-state/COMMAND.md` — bootstrap context and analyze branch reality to help decide next steps
- `ai/commands/start-feature/COMMAND.md` — set up the workspace for a new feature (branch name, workspace strategy, branch creation)
- `ai/commands/validate/COMMAND.md` — run the full validation suite
- `ai/commands/review/COMMAND.md` — internal code review (diff-based, pre-PR)
- `ai/commands/open-pr/COMMAND.md` — open a GitHub PR with the project's standard format
- `ai/commands/address-pr-comments/COMMAND.md` — fetch PR review threads, triage, fix with Fix Loop Decision Rules, prepare reply text
- `ai/commands/finish-feature/COMMAND.md` — mark plan complete, merge PR via GitHub CLI, clean up branch or worktree

### Adding A New Command

1. Create a folder at `ai/commands/<command-name>/`.
2. Add a `COMMAND.md` file with YAML frontmatter (`name`, `description`, `triggers`, `inputs`, `outputs`).
3. Write the procedure as numbered steps with clear completion criteria.
4. Reference it from this section.

Commands complement skills, not replace them. A command may reference a skill when domain context is needed during execution. See `ai/commands/README.md` for the full file format.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown.

If a specific AI tool requires its own config file (e.g., `.gemini/settings.json`, `CLAUDE.md`, `.cursor/rules`), that file should contain **only provider configuration** (model selection, context settings, etc.). Never duplicate instructions from `AGENTS.md` or skills into provider config files.
