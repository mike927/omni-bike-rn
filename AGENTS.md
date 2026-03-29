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
5. If the current branch is not `main`, read `ai/workflows/<branch-slug>.md` when it exists
6. Relevant files under `ai/skills/*/SKILL.md`
7. When the task involves vendor-specific behavior or hardware, check `docs/` for trusted reference material

`plan.md` is the single source of truth for project scope and progress.
`branch-slug` means the branch name with `/` replaced by `-`.

## Task States In `plan.md`

Use these task states consistently:

- `[ ]` not started
- `[~]` in progress
- `[?]` blocked or needs clarification
- `[R]` implemented and in review, approved, or waiting for merge
- `[x]` merged and completed
- `[-]` intentionally skipped or deferred

When using `[?]` or `[-]`, include a short reason in the same task line.

## Worktree And Branch Rules

- Never work directly on `main`.
- Treat the repository root on `main` as a coordination and read-only workspace. Do not mutate repo-tracked files there.
- Default worktree root: `../omni-bike-rn-worktrees/`.
- Any task that may mutate repo state must happen in a dedicated worktree on a non-`main` branch.
- Name each worktree directory with the `branch-slug`.
- Use common branch prefixes:
  - `feature/*`
  - `bugfix/*`
  - `hotfix/*`
- Reuse an existing worktree when resuming the same branch. Create a new worktree only when starting a new branch.
- When a feature branch is merged and the local worktree is safely stale, remove the worktree to keep the local filesystem clean.

Examples:

- `feature/ble-metronome-engine`
- `bugfix/ftms-status-parser`
- `../omni-bike-rn-worktrees/feature-ble-metronome-engine`

## Commit Rules

- Use Conventional Commits.
- Make focused commits per meaningful sub-task, not one large commit at the end.

Examples:

- `feat: add BLE metronome engine`
- `fix: correct FTMS machine status parsing`
- `docs: update project progress in plan`

## Workflow Artifacts

- `ai/plans/<branch-slug>.md`: the approved implementation plan for the active branch. Create it before implementation and keep it current enough for a handoff.
- `ai/workflows/<branch-slug>.md`: the tracked workflow state file for the active branch. Use it so any new conversation can resume from the current workflow step without relying on chat history.
- `ai/reviews/<branch-slug>.md`: internal review findings and follow-up notes for the active branch.
- `ai/testing/<branch-slug>.md`: saved manual testing checklist. Create or update it only when the human explicitly asks for a persistent checklist file.
- Reuse the same `branch-slug` across all branch-scoped AI artifacts.
- Treat branch-specific AI artifacts as temporary working files. After the feature is merged and cleanup is safe, remove the branch's `ai/plans/`, `ai/workflows/`, `ai/reviews/`, and `ai/testing/` files when they exist.

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

### Workflow Status Messages

- For substantive user-facing messages, start with a short header that tells the human what kind of message this is.
- Prefer these headers:
  - `**Workflow Progress**`
  - `**Plan**`
  - `**Question**`
  - `**Feature Summary**`
  - `**Manual Testing**`
  - `**Review**`
  - `**Blocked**`
- Keep headers short, stable, and purpose-based. Do not invent a new header when one of the standard labels already fits.
- The agent must post a workflow status message at session start, on every workflow-step transition, whenever blocked, and before waiting on human approval or manual testing.
- After completing any workflow step and before stopping or waiting, the agent must also post a short step-transition message in chat so the human can immediately see what just finished and what comes next without opening any markdown files.
- Every step-transition message must include a second short section that explains the outcome of the completed stage in plain language so the human gets an immediate overview of the current state.
- Keep the status message concise and include all of these fields:
  - `Task`
  - `Branch`
  - `Worktree`
  - `Current step`
  - `Completed steps`
  - `Next step`
  - `Blockers`
- `Active artifacts`
- Use this format:

```md
Workflow status
- Task: <feature or fix name>
- Branch: <branch-name>
- Worktree: <absolute-or-relative-worktree-path>
- Current step: <number and title>
- Completed steps: <comma-separated list or none>
- Next step: <next concrete action>
- Blockers: <none or short reason>
- Active artifacts: <comma-separated paths>
```

- Use this step-transition format every time progress moves to a new workflow step, and also when pausing at the end of a turn:

```md
**Workflow Progress**
✅ Completed: <step number and title>
➡️ Next: <step number and title>

**Stage Summary**
<2-4 short lines describing what the completed stage produced, decided, or verified>
```

- If the agent is blocked instead of progressing, use this format:

```md
**Workflow Progress**
⛔ Blocked at: <step number and title>
➡️ Next: <the unblock action or decision needed>

**Stage Summary**
<short explanation of what was attempted, what is currently true, and why progress is blocked>
```

- If the current turn finishes in the middle of a step, use this format:

```md
**Workflow Progress**
🛠️ In Progress: <step number and title>
➡️ Next: <step number and title that follows when this one is done>

**Stage Summary**
<short explanation of what has already been done in the current step and what remains>
```

- Keep the wording consistent. Always include the step number and exact step title from `AGENTS.md`.
- Tailor the `Stage Summary` to the stage:
  - planning: what the plan now covers or what decision was locked
  - implementation: what changed
  - validation: what was run and whether it passed
  - review: what was checked and whether issues were found
  - manual testing: what the human should verify
  - merge/cleanup: what was merged or removed
- Preserve the header text, icon order, and inline `Completed` / `Next` phrasing so the message is easy to scan in chat.

### 0. Bootstrap / Resume Context

- Open `plan.md` and understand the next relevant task.
- Read this `AGENTS.md`.
- Check `git branch --show-current` and `git worktree list`.
- Derive the `branch-slug`.
- If the current branch is not `main` and `ai/workflows/<branch-slug>.md` exists, treat the session as a resume:
  - read the workflow file first
  - continue from its current step
  - do not restart planning or implementation from scratch
- If the current branch is `main` or no workflow file exists, treat the session as a new task and continue to step 1.

### 1. Worktree Ready

- If starting a new task, create a dedicated worktree at `../omni-bike-rn-worktrees/<branch-slug>` before any repo mutation.
- Use a `feature/*`, `bugfix/*`, or `hotfix/*` branch as appropriate.
- Do not implement from the repo root on `main`.
- If the task is a resume, confirm the existing worktree path and branch instead of creating a second worktree.
- Create or update `ai/workflows/<branch-slug>.md` as soon as the worktree is established.

### 2. Detailed Plan Prepared

- Ask questions only when the missing detail is a business or product decision.
- Do not ask questions that can be answered from the repository.
- **Ask product/business questions interactively: always offer 2–4 concrete options per question plus a free-text escape hatch. Use the best mechanism available in your environment (e.g. `AskUserQuestion` tool, numbered list, etc.). Never ask open-ended questions when choices can be offered.**
- Before implementation, write a detailed plan to `ai/plans/<branch-slug>.md` based on the relevant raw task in `plan.md`.
- The detailed plan must be specific enough to execute without further design decisions during implementation.
- Record the plan path in `ai/workflows/<branch-slug>.md`.

### 3. Detailed Plan Approved

- Share the plan file with the user and wait for explicit approval before writing code.
- Discuss and iterate on the plan until approved.
- Technical implementation choices are left to the agent unless the detailed plan exposes a product or business tradeoff that requires user input.
- If work is blocked on a business decision, update both the relevant `plan.md` item and `ai/workflows/<branch-slug>.md` with `[?]` plus a short reason.

### 4. Implementation In Progress

- When active implementation starts, update the relevant `plan.md` item to `[~]`.
- Break the work into small, meaningful sub-tasks.
- Implement fully, not partially.
- Keep commits focused.
- Keep `ai/workflows/<branch-slug>.md` current enough that a fresh agent can resume without rereading the entire chat.

### 5. Validation Complete

- Run the most relevant validation for the change.
- Record what was run, what passed, and what was intentionally not run in `ai/workflows/<branch-slug>.md`.
- Do not move forward with unclear validation status.

### 6. Internal Review

- After implementation, perform an internal review with another agent when available.
- The review should focus on bugs, regressions, missing tests, and architecture risks.
- Track review notes in `ai/reviews/<branch-slug>.md` when a durable review file is needed.

### 7. Internal Review Fix Loop

- If internal review finds issues, fix them before asking the human to test.
- After each review-driven code change:
  - rerun the most relevant validation
  - update `ai/workflows/<branch-slug>.md` with what changed and what was rerun
  - rerun internal review when the change is substantial, architectural, or likely to hide follow-on issues
- If internal review is already clean, mark this step complete with a short note such as `no fixes needed`.

### 8. Manual Human Testing

- Before opening a Pull Request, the agent MUST pause and ask the human to manually test the changes on their device or simulator.
- Along with the testing request, provide a concise summary of what was implemented and how the change affects the user experience or behavior.
- Every manual testing request must explicitly say whether the human needs to restart the Metro server, rebuild the app, both, or neither before testing. If no restart or rebuild is needed, say that explicitly.
- Provide the testing checklist directly in the conversation window. Use a short numbered list for the key validation path, and expand it only as much as needed for the current change.
- For follow-up fixes after initial manual testing, provide only the incremental retest steps that matter for the latest change unless the full flow needs to be re-run.
- Do not create or update `ai/testing/<branch-slug>.md` unless the human explicitly asks for a saved checklist file.
- Wait for the human's feedback. Address any issues they find.
- Only proceed to the next step once the human explicitly approves the manual test.
- When implementation is complete and approved locally, update the plan item to `[R]`.

### 9. Manual Testing Fix Loop

- If manual testing feedback leads to code changes, do not jump straight to PR.
- After each manual-testing-driven code change:
  - rerun the most relevant validation
  - request targeted manual retesting for the affected behavior unless the change is provably non-user-visible
  - rerun internal review as well when the change is substantial, risky, architectural, or touches native behavior
- Stay in this loop until the human explicitly confirms the latest changes.

### 10. PR Open

- If GitHub access is available, open a pull request with a concise summary.
- If GitHub access is not available, prepare the pull request summary for a human to open manually.
- While the pull request is open and waiting for review, keep the related plan item at `[R]`.
- Include:
  - what changed
  - why it changed
  - what was validated
- Record the PR status in `ai/workflows/<branch-slug>.md`.

### 11. PR Review Comments

- After the pull request is open, manually instruct the local agent to check GitHub for review comments and unresolved review threads.
- Once asked to do this, the agent should treat GitHub review comments as the primary review queue for the branch.
- Default behavior after checking GitHub:
  - fetch unresolved review threads and actionable inline comments
  - prioritize bugs, regressions, missing tests, and architecture risks
  - apply fixes for clearly actionable comments without waiting for extra approval
  - explicitly call out comments that are declined or intentionally left unchanged, with reasons
  - run the most relevant validation after each fix
  - prepare short reply text the human can paste into GitHub for each addressed thread
- Only treat a review comment as resolved after the fix is implemented, validated, and pushed.
- If GitHub permissions allow, the agent may reply to and resolve addressed review threads directly. Otherwise, it should prepare the exact reply or resolution notes for the human.

### 12. PR Review Fix Loop

- If PR review feedback leads to code changes:
  - rerun the most relevant validation after each fix
  - rerun internal review when the fix is substantial, risky, or architectural
  - request targeted manual retesting when the fix changes user-visible behavior, product flow, native behavior, or anything the human previously validated manually
  - prepare updated reply text or direct GitHub replies only after the fix and required revalidation are complete
- Repeat the PR review and fix loop up to 3 times. Stop earlier if the review queue is already clean.

### 13. Ready For Merge

- Do not mark work as `[x]` after approval alone.
- Keep the plan item at `[R]` until the branch is actually merged.
- Use `[-]` only when work is intentionally skipped or deferred, with a short reason.
- Keep `plan.md` aligned with accepted progress, not only local code state.
- Record any final pre-merge plan updates in a separate small commit, not inside the original implementation commit.

Example:

- `docs: mark harness refactor as approved in plan`

### 14. Human Merge / Cleanup

- Merge is done by a human.
- After merge is confirmed, verify the feature branch has no remaining unmerged local-only work, no pending review or testing actions, and no unpushed commits that should be preserved.
- If the worktree is dirty, merge status is unclear, or the branch still has work to keep, stop and report the blocker instead of deleting anything.
- Once merge is confirmed, do any repo-tracked cleanup from a fresh non-`main` follow-up branch created from the latest `main`. Do not edit repo-tracked files directly on `main`.
- In that follow-up branch:
  - update the relevant `plan.md` item to `[x]` because completed means merged
  - remove the branch-specific workflow artifacts that are no longer needed:
    - `ai/plans/<branch-slug>.md`
    - `ai/workflows/<branch-slug>.md`
    - `ai/reviews/<branch-slug>.md`
    - `ai/testing/<branch-slug>.md` when it exists for that branch
  - record those merged-state and cleanup changes in a separate small commit
- Once the worktree is safely stale:
  - remove it from `git worktree`
  - delete the local worktree directory
- After cleanup, return to `main` in the repo root.

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
- `ai/skills/stitch-design/SKILL.md` for UI design with Google Stitch, MCP integration, and design-to-code conversion

### Adding A New Skill

1. Create a folder at `ai/skills/<skill-name>/`.
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`).
3. Write domain-specific content: context, key files, patterns, known issues.
4. Reference it from this section.

Skills are optional helpers. They support this file, not replace it.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown.

If a specific AI tool requires its own config file (e.g., `.gemini/settings.json`, `CLAUDE.md`, `.cursor/rules`), that file should contain **only provider configuration** (model selection, context settings, etc.). Never duplicate instructions from `AGENTS.md` or skills into provider config files.
