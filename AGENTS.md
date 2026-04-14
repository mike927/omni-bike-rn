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
6. When the user asks for a specific procedure (code-review, address-code-review, validate, check-state, start-feature, open-pr, finish-feature), load the matching `ai/commands/*/COMMAND.md`
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

- You must execute the workflow strictly and sequentially. Do not spontaneously skip numbered workflow steps. In particular, (branch creation) must always precede planning — never enter planning mode while still on `main`, because the plan file path `ai/local/plans/<branch-slug>.md` is not valid without a feature branch and planning mode is read-only, so it locks you out of branch creation until you exit.
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

- **This step must complete before Step 3 begins.** The feature branch must exist and be checked out before any planning mode is activated, because Step 3 writes the plan to `ai/local/plans/<branch-slug>.md` and that path is only valid once the branch exists.
- Execute the `/start-feature` command logic.
- If the task is a resume, verify where the current branch exists and continue working there instead of creating a new workspace.
- If the host has already entered planning mode before this step ran (e.g. the human or a prior agent toggled it early), pause and ask the human to exit planning mode so the branch can be created. Do not attempt to draft a plan from `main`.

### 3. Detailed Plan Prepared

- **Prerequisite: Step 2 (Workspace Ready) must be complete** before this step begins.
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
- **Canonical plan location.** The plan must always end up at `ai/local/plans/<branch-slug>.md`. If your host's planning mode writes the draft to a host-managed path, that copy is only a draft — the moment the plan is complete, immediately move it (not copy — the host-local file must not linger) to `ai/local/plans/<branch-slug>.md` so there is a single canonical file. Do not leave plans stranded in host memory or per-agent local storage, and never rely on a host-managed plan path for review, approval, or hand-off.
- Every saved plan file must end with a final section titled `## What Will Be Available After Completion`. This must be the bottom section of the file and should concisely describe the completed capabilities, user flows, integrations, screens, behaviors, and other meaningful deliverables that will exist after the task is done. Favor end-state outcomes over implementation recap; mention technical/internal deliverables only when they materially affect what will be available after completion.
- After saving the plan, run `/review-plan`. If the recommendation is `revise`, run `/address-plan-review` to resolve findings, then re-run `/review-plan`. Repeat until `/review-plan` reports `ready`. **Only a `ready` result from `/review-plan` passes the plan-quality gate — do not advance to Step 4 until it is reached.** If `/address-plan-review` reports `blocked`, surface the unresolved questions to the human and wait for answers before re-running `/review-plan`.

### 4. Detailed Plan Approved

- Share the plan file with the user and wait for explicit approval before writing code. Discuss and iterate on the plan until approved.
- Technical implementation choices are left to the agent unless the detailed plan exposes a product or business tradeoff that requires user input.
- Once approved, deactivate planning mode before proceeding to implementation.
- If the host requires the human to switch modes manually, or only supports manual planning-phase confirmation, explicitly ask the human to return the session to edit mode or confirm that implementation may begin, and wait for confirmation before writing code.

### 5. Implementation In Progress

- **Before writing any code**, verify that the working directory is on the correct feature branch (`git branch --show-current`). Plan mode or host mode switches can silently reset the branch. If the branch is wrong, switch to the correct one before proceeding.
- When active implementation starts, update the relevant `plan.md` item to `[~]`.
- Break the work into small, meaningful sub-tasks.
- Implement fully, not partially.
- Keep commits focused.
- **Do not continuously update** `ai/local/plans/<branch-slug>.md` to check off tasks while coding. Progress is tracked via `git log` and `git status`. Use `/check-state` to re-sync if context is lost.

### 6. Validation Complete

- Execute the `/validate` command logic.
- Do not move forward to review or testing until validation explicitly passes.

### 7. Internal Review

Internal review has two phases: a self-pass by the main agent, then a delegated deep review by a dedicated reviewer subagent with fresh context. The main agent's context is biased toward the path it already took, so self-review alone is not sufficient for logic changes.

**Phase A — Self-pass (main agent).**

- Run a code quality pass on the branch diff: duplication, efficiency, unnecessary nesting. Fix what you find inline.
- This pass is cheap and benefits from full main-agent context, so it is the right place to catch obvious smells before delegating.

**Phase B — Delegated review (dedicated subagent).**

- Spawn a dedicated reviewer subagent with fresh context. Do not run `/code-review` inline as the main agent.
- Before delegating, write a short review brief (2-5 sentences) covering: the intent of the change, what is explicitly out of scope, any tradeoffs already agreed with the human, and a pointer to the relevant `plan.md` item or `ai/local/plans/<branch-slug>.md`. The brief is the single biggest lever for review quality — without one the subagent produces generic noise.
- Pass the brief plus the `/code-review` command logic to the subagent. The subagent owns `/code-review` end-to-end, including writing findings to `ai/local/reviews/<branch-slug>.md`. Default source is `local`; use `gh` only when you want to review what is actually in the open PR rather than local HEAD.
- **Verification**: before marking this step complete, confirm that `ai/local/reviews/<branch-slug>.md` exists on disk and was updated in this run. If it was not, the subagent did not actually execute `/code-review` and the step must be re-run. All review findings — internal and PR — must persist in this file so follow-up agents across providers can act on them without re-running the review.
- Map any provider-native subagent primitives (dedicated reviewer subagent types, isolated sub-task spawning) in the provider-specific entrypoint file, not here.

### Fix Loop Decision Rules

Use these rules for Internal Review Fix Loop, Manual Testing Fix Loop, and PR Review Fix Loop so the decision logic lives in one place.

| Change type | `/validate` scope | `/code-review` execution | Require human retest? |
|---|---|---|---|
| Docs, comments, text-only, narrow non-runtime refactor | `quick` | inline (main agent) | No |
| Test-only | `test` | inline (main agent) | No |
| Runtime logic, routing, persistence, BLE, native, user-visible | `full` | inline (small fix) or respawned reviewer subagent (larger fix) | Step 10/13: yes |
| Fix touches architecture, contracts, shared state, or could invalidate earlier review | `full` | respawned reviewer subagent | Step 10/13: yes |

A fix loop is clean only when the selected validation passes, no unresolved blocking review findings remain, and any required retest or PR follow-up for that stage is complete.

### 8. Internal Review Fix Loop

- If internal review finds issues, fix them before asking the human to test.
- After each review-driven code change, follow the Fix Loop Decision Rules for validation scope and review execution.
- For small incremental fixes the main agent may run `/code-review` inline since it just saw the subagent's findings and has context to verify targeted fixes. For larger fixes — or whenever the rules table says "respawned reviewer subagent" — spawn a fresh reviewer subagent with a new brief rather than reusing the main agent.
- Do not proceed to manual testing until the fix loop is clean.
- Once the internal review fix loop is clean, end Step 8 in a saved state: commit the resulting changes before Step 9 so manual testing starts from a clean working tree. If no review-driven code changes were needed, explicitly note that no commit was created.
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
- After each manual-testing-driven code change, follow the Fix Loop Decision Rules for validation scope and review execution.
- Request targeted manual retesting only for the affected behavior unless the change is provably non-user-visible.
- Stay in this loop until the human explicitly confirms the latest changes.

### 11. PR Open

- Execute the `/open-pr` command logic.
- The `/open-pr` command owns the `plan.md [x]` commit — it marks the task as completed and pushes the commit as part of its final step. No additional plan update is needed after this step.

### 12. PR Review Comments

- Execute the `/address-code-review` command logic.
- GitHub review comments are the primary review queue for the branch once the PR is open.
- Only treat a review comment as resolved after the fix is implemented, validated, and pushed.

### 13. PR Review Fix Loop

- If PR review feedback leads to code changes:
  - follow the Fix Loop Decision Rules for validation scope and review execution
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

- `ai/skills/harness-authoring/SKILL.md` for creating or modifying harness files (`AGENTS.md`, commands, skills, provider bridges)
- `ai/skills/architecture/SKILL.md` for boundaries, ownership, and structure
- `ai/skills/ble-hardware/SKILL.md` for BLE, FTMS, bike devices, or heart-rate work
- `ai/skills/drizzle-expo/SKILL.md` for official Drizzle ORM workflow in Expo: schema changes, drizzle-kit generation, bundled migrations, and startup wiring
- `ai/skills/expo-ui/SKILL.md` for Expo Router UI, navigation, styling, and components
- `ai/skills/expo-upgrade/SKILL.md` for Expo SDK upgrades and dependency migrations
- `ai/skills/ios-native/SKILL.md` for iOS-specific behavior
- `ai/skills/provider-entrypoints/SKILL.md` for defining lean provider-specific entrypoint files that enrich the shared workflow with provider-native capabilities
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

**Resolution is by file path, not by slash picker.** Slash syntax (`/code-review`, `/validate`, etc.) is ergonomic shorthand used throughout this document. The contract is always `ai/commands/<name>/COMMAND.md` — load that file directly. Do not depend on your client's command picker to surface the command; discoverability varies per client and some clients surface nothing at all. If the canonical file cannot be read, the step is blocked.

**Client-specific bridges are optional.** A client may wrap commands as slash-commands, skills, or whatever primitive it supports. Bridges exist purely as ergonomic sugar for the human composing prompts — they must resolve to the same canonical file, and the harness must continue to work when they are absent. Document any such bridge in the matching provider entrypoint file, never here. Do not add a bridge for a client that is not in the user's active rotation.

Available commands:

- `ai/commands/check-state/COMMAND.md` — bootstrap context and analyze branch reality to help decide next steps
- `ai/commands/start-feature/COMMAND.md` — set up the workspace for a new feature (branch name, workspace strategy, branch creation)
- `ai/commands/review-plan/COMMAND.md` — review the active branch plan for decision-completeness, workflow alignment, and implementation readiness
- `ai/commands/address-plan-review/COMMAND.md` — triage plan-review findings, update the plan intentionally, and record applied or declined suggestions
- `ai/commands/validate/COMMAND.md` — run the full validation suite
- `ai/commands/code-review/COMMAND.md` — code review of branch diff (local working tree or GitHub PR), persisted to `ai/local/reviews/<branch-slug>.md`
- `ai/commands/open-pr/COMMAND.md` — open a GitHub PR with the project's standard format
- `ai/commands/address-code-review/COMMAND.md` — consume code review findings (local file or GitHub PR threads) and fix each actionable item using the Fix Loop Decision Rules
- `ai/commands/finish-feature/COMMAND.md` — mark plan complete, merge PR via GitHub CLI, clean up branch or worktree

### Adding A New Command

1. Create a folder at `ai/commands/<command-name>/`.
2. Add a `COMMAND.md` file with YAML frontmatter (`name`, `description`, `triggers`, `inputs`, `outputs`).
3. Write the procedure as numbered steps with clear completion criteria.
4. Reference it from this section.

Commands complement skills, not replace them. A command may reference a skill when domain context is needed during execution. See `ai/commands/README.md` for the full file format.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown.

If a specific AI tool requires its own config file, that file should contain only provider-specific configuration and minimal provider-specific execution notes that adapt `AGENTS.md` to that tool. Do not duplicate repository workflow instructions in full.
- If a provider supports explicit plan/edit mode APIs, use them.
- If a provider does not support agent-controlled mode switching, the workflow still requires the same plan/edit separation, but the human must perform the mode switch manually.
