# Agent Instructions

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
6. When the user asks for a specific procedure (review, PR, validate, check-state, start-feature, open-pr, address-pr-comments, finish-feature), load the matching `ai/commands/*/COMMAND.md`
7. When the task involves vendor-specific behavior or hardware, check `docs/` for trusted reference material

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

- Never commit changes directly to `main`.
- **In-Place Branching**: Standard branches (`git checkout -b <branch>`) directly in the repository root. Preferred for linear development.
- **Worktree Branching**: Dedicated worktree (`../omni-bike-rn-worktrees/<branch-slug>`) when explicitly requested for parallel isolation.
- Name branches as `<type>/<kebab-case-description>` using Conventional Commits prefixes (e.g., `feat/`, `fix/`, `docs/`, `refactor/`). Determine the prefix automatically based on task scope.

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

- `ai/local/plans/<branch-slug>.md`: the local implementation plan for the active branch. Treat as a read-only blueprint once approved; do not update it continuously to track progress unless the fundamental scope changes.
- `ai/local/reviews/<branch-slug>.md`: local internal review findings and follow-up notes for the active branch.
- `ai/local/testing/<branch-slug>.md`: local saved manual testing checklist. Create or update only when the human explicitly asks for a persistent checklist file.
- Reuse the same `branch-slug` across all branch-scoped AI artifacts.
- These files are local-only and ignored by git. Do not open PRs just to add, update, or remove them.

## Coding Conventions

### TypeScript

- Strict mode is enforced. `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch` are on.
- Never use `as any`. Use the actual schema or type returned by a given service.
- Use `type` imports for type-only values. Enforced by ESLint (`consistent-type-imports`).
- Prefer `interface` for contracts and public API shapes. Use `type` for unions, intersections, and utility types.
- Interfaces and type aliases use `PascalCase`. Enum members use `UPPER_CASE` or `PascalCase`.
- Do not declare reusable interfaces or type aliases inside implementation files such as adapters, hooks, screens, or components. Put them in a dedicated sibling file, contract file, or `src/types/` module and import them where needed.
- Do not use magic values (inline UUIDs, URLs, numeric constants). Define named constants at module scope. If the same value is needed in multiple files, define it once and import it.

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

### Workflow Scope

This workflow applies to **all code changes**, not only pre-planned features in `plan.md`. Bug fixes, ad-hoc investigations, refactors, and any user request that will result in code modifications must follow the same numbered steps.

For unplanned work (e.g., a bug the user reports during a session):

- **Analysis is free.** Reading code, tracing logic, and discussing findings does not trigger the workflow.
- **The moment a code change is agreed upon**, the workflow activates. Start from Step 2 (Workspace Ready) — create a branch, then proceed through planning, implementation, validation, review, testing, and PR as normal.
- **plan.md updates are optional.** Mark an existing item if the fix addresses one; otherwise skip plan.md references in the workflow steps but follow everything else.

### Workflow Pacing and Discipline

- You must execute the workflow strictly and sequentially. Do not spontaneously skip numbered workflow steps.
- Do not chain multiple distinct workflow steps together in a single turn. Pause at the logical end of your current step, report your progress via a Chat Progress Update, and await explicit human instruction before executing the next numbered phase.
- If a step is logically irrelevant for a given task (e.g., Manual Human Testing for a pure documentation update), you must still output the `**Workflow Progress**` header for that step, formally note that it is being skipped, and provide a super concise reason why. Do not silently skip past it.
- Agents with terminal capabilities should run CLI commands natively instead of instructing the human to paste them, provided it stays within tool-call approval constraints.
- During complex debugging, do not pollute the project root with temporary scripts or data dumps. Use the agent's isolated sandbox directory or standard OS temporary directories (`/tmp/`), and clean them up afterward.

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
- Keep headers short, stable, and purpose-based. Do not invent a new header instead of standard labels if they fit.

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
- If the task is a resume, verify where the current branch exists and continue working there instead of creating a new workspace.

### 3. Detailed Plan Prepared

- If your host environment supports a dedicated planning mode (read-only, no file writes), activate it now before drafting the plan.
- If the mode must be set by the human rather than the agent, pause and explicitly ask the human to enable planning mode before proceeding.
- If the host has no true planning mode, pause and explicitly ask the human to confirm that the session is in a planning-only phase before proceeding.
- Until planning mode is confirmed, remain read-only for normal repo work:
  - no file edits or file creation outside `ai/local/plans/<branch-slug>.md`
  - no branch changes
  - no commits
- While waiting for planning mode, you may continue reading repository files needed to prepare the plan.
- Only ask questions about business/product decisions; do not ask questions that can be answered by reading the repository.
- **Ask product/business questions interactively: always offer 2–4 concrete options per question plus a free-text escape hatch. Use the most interactive mechanism your platform provides (e.g., dedicated UI prompts, tool calls, or simply numbered lists in chat). Never ask open-ended questions when choices can be offered.**
- If work is blocked on a business decision, update the relevant `plan.md` item with `[?]` plus a short reason.
- Before implementation, write a detailed plan to `ai/local/plans/<branch-slug>.md` based on the relevant raw task in `plan.md`. The detailed plan must be specific enough to execute without further design decisions during implementation.

### 4. Detailed Plan Approved

- Share the plan file with the user and wait for explicit approval before writing code. Discuss and iterate on the plan until approved.
- Technical implementation choices are left to the agent unless the detailed plan exposes a product or business tradeoff that requires user input.
- Once approved, deactivate planning mode before proceeding to implementation.
- If the host requires the human to switch modes manually, or only supports manual planning-phase confirmation, explicitly ask the human to return the session to edit mode or confirm that implementation may begin, and wait for confirmation before writing code.

### 5. Implementation In Progress

- When active implementation starts, update the relevant `plan.md` item to `[~]`.
- Break the work into small, meaningful sub-tasks.
- Implement fully, not partially.
- Keep commits focused.
- **Do not continuously update** `ai/local/plans/<branch-slug>.md` to check off tasks while coding. Progress is tracked via `git log` and `git status`. Use `/check-state` to re-sync if context is lost.

### 6. Validation Complete

- Execute the `/validate` command logic.
- Do not move forward to review or testing until validation explicitly passes.

### 7. Internal Review

- Before running `/review`, do a code quality pass on the branch diff: look for duplication, efficiency issues, and unnecessary nesting, and fix what you find.
- Then execute the `/review` command logic to deeply analyze the diff for bugs, regressions, missing tests, and architecture risks.
- Use `/review branch` as the default first pre-test review on the branch.
- Let the `/review` command own review-file creation and cleanup behavior in `ai/local/reviews/<branch-slug>.md`.

### Fix Loop Decision Rules

Use these rules for Internal Review Fix Loop, Manual Testing Fix Loop, and PR Review Fix Loop so the decision logic lives in one place.

| Change type | `/validate` scope | `/review` scope | Require human retest? |
|---|---|---|---|
| Docs, comments, text-only, narrow non-runtime refactor | `quick` | `staged` | No |
| Test-only | `test` | `staged` | No |
| Runtime logic, routing, persistence, BLE, native, user-visible | `full` | `staged` (small fix) or `branch` (see below) | Step 10/13: yes |
| Fix touches architecture, contracts, shared state, or could invalidate earlier review | `full` | `branch` | Step 10/13: yes |

A fix loop is clean only when the selected validation passes, no unresolved blocking review findings remain, and any required retest or PR follow-up for that stage is complete.

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
- Provide the testing checklist inline. For follow-up fixes, provide only incremental retest steps unless the full flow needs re-running.
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

### 14. Merge And Cleanup

- Wait for the human to confirm the PR is approved and that merging should proceed.
- Then execute the `/finish-feature` command logic.
- The command marks `plan.md` as `[x]`, merges the PR via GitHub CLI (merge commit), safety-checks the local workspace, removes the branch or worktree, and returns to `main`.

## Skills

Use a skill when the task clearly matches that domain.

Available skills:

- `ai/skills/architecture/SKILL.md` for boundaries, ownership, and structure
- `ai/skills/ble-hardware/SKILL.md` for BLE, FTMS, bike devices, or heart-rate work
- `ai/skills/drizzle-expo/SKILL.md` for official Drizzle ORM workflow in Expo: schema changes, drizzle-kit generation, bundled migrations, and startup wiring
- `ai/skills/expo-ui/SKILL.md` for Expo Router UI, navigation, styling, and components
- `ai/skills/expo-upgrade/SKILL.md` for Expo SDK upgrades and dependency migrations
- `ai/skills/ios-native/SKILL.md` for iOS-specific behavior
- `ai/skills/provider-entrypoints/SKILL.md` for defining lean provider-specific entrypoint files (`CODEX.md`, `CLAUDE.md`, `GEMINI.md`) that enrich the shared workflow with provider-native capabilities
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

Commands are active procedures for specific, repeatable tasks. They complement skills (passive reference).

**Commands are mandatory.** When a workflow step references a command (e.g., "Execute the `/open-pr` command logic"), the agent must load and follow the matching `COMMAND.md` file — never improvise or inline the procedure. This applies whether triggered by the human or reached organically during the workflow.

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

If a specific AI tool requires its own config file (e.g., `.gemini/settings.json`, `CLAUDE.md`, `CODEX.md`, `.cursor/rules`), that file should contain only provider-specific configuration and minimal provider-specific execution notes that adapt `AGENTS.md` to that tool. Do not duplicate repository workflow instructions in full.
- If a provider supports explicit plan/edit mode APIs, use them.
- If a provider does not support agent-controlled mode switching, the workflow still requires the same plan/edit separation, but the human must perform the mode switch manually.
