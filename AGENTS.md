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

## Harness Principles

- **Single Ownership.** Every harness rule, convention, procedure, or state transition has exactly one owner. Every other reference cross-links to that owner rather than restating it.

## Core Sources

Read these in this order before feature work:

1. `plan.md`
2. This `AGENTS.md` file
3. `git branch --show-current`
4. `git worktree list`
5. Relevant files under `ai/skills/*/SKILL.md`
6. When the user asks for a procedure documented in `## Commands` below, load the matching `ai/commands/<name>/COMMAND.md`
7. When the task involves vendor-specific behavior or hardware, check `docs/` for trusted reference material

`plan.md` is the single source of truth for tracked project scope and progress. Some approved ad-hoc branch-local work may proceed without being added there.
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

Branch-local work with no matching `plan.md` item skips every state transition in the numbered workflow (`[~]`, `[R]`, `[x]`). Workflow steps still reference these marks; just bypass them when no `plan.md` item applies.

## Native iOS Constraints

Do not run `expo prebuild --clean` after the watchOS companion app target has been added to `ios/`. The `--clean` flag wipes the entire `ios/` directory and destroys the Watch target. Use `expo prebuild` (without `--clean`) for incremental config changes. If `--clean` was accidentally run, restore `ios/OmniBikeWatch/` and the Watch target from git.

- The `ios/` directory is intentionally committed to git (partial eject — watchOS companion app target).
- The Watch target (`OmniBikeWatch`) and its three Swift files live in `ios/OmniBikeWatch/` and are managed manually in Xcode.
- The config plugin `plugins/with-watch-extension.js` only adds entitlements and Info.plist keys — it is safe to re-apply at every prebuild run.

## Branching And Workspace Rules

- Never commit changes directly to `main`.
- **In-Place Branching**: Standard branches (`git checkout -b <branch>`) directly in the repository root. Default for normal feature work.
- **Worktree Branching**: Dedicated worktree (`../omni-bike-rn-worktrees/<branch-slug>`) when explicitly requested for parallel isolation.
- Name branches as `<type>/<kebab-case-description>` using Conventional Commits prefixes (e.g., `feat/`, `fix/`, `docs/`, `refactor/`). Determine the prefix automatically based on task scope.

Examples:

- `feat/ble-metronome-engine`
- `fix/ftms-status-parser`
- `../omni-bike-rn-worktrees/feat-ble-metronome-engine`

## Commit Rules

- **No Auto-Committing:** Never run `git commit` automatically after writing code or modifying files unless the human explicitly instructed you to do so in their prompt. Always leave the working tree dirty, report the changes made, and wait for the human to review the diff in their IDE and suggest the next action. **Exceptions:** (1) The automated pipeline (Steps 6–9) is pre-approved by the human's Step 5 approval; commits within that pipeline may run without a separate prompt, including the validated implementation snapshot commit before Step 8 and any review-fix commits in Step 9. (2) `/address-code-review` always commits and pushes each fix as part of its procedure — the human's decision to run the command is the explicit instruction to commit and push.
- Use Conventional Commits.
- Make focused commits per meaningful sub-task, not one large commit at the end.

Examples:

- `feat: add BLE metronome engine`
- `fix: correct FTMS machine status parsing`
- `docs: update project progress in plan`

## Workflow Artifacts

- `ai/local/plans/<branch-slug>.md`: the local implementation plan for the active branch. Treat as a read-only blueprint once approved; do not update it continuously to track progress unless the fundamental scope changes. If the host provides a native plan tool that writes to its own location, mirror plan content to this canonical path so other providers can access it.
- `ai/local/reviews/<branch-slug>.md`: local internal review findings and follow-up notes for the active branch.
- `ai/local/testing/<branch-slug>.md`: local saved manual testing checklist. Create or update only when the human explicitly asks for a persistent checklist file.
- Reuse the same `branch-slug` across all branch-scoped AI artifacts.
- These files are local-only and ignored by git. Do not open PRs just to add, update, or remove them.

### Review File State

Under the append-mode contract (§ `Commands`), every `/code-review` invocation appends a new `## Review (<provider>, <ISO>)` block. The review file has no file-level `State:` header — state lives on the `State:` line **inside** the latest block. Every rule below resolves against that latest block.

| State (latest block) | Meaning | Written by (inside that block) |
|---|---|---|
| `needs-review` | Review in progress, or fixes await re-review | `/code-review` at start of its block; `/address-code-review` when all findings are resolved |
| `needs-changes` | Latest review has unresolved actionable findings | `/code-review` |
| `ready` | Latest review is clean | `/code-review` only |

- `/code-review` is the only command that writes `State: ready` (in the block it just appended).
- `/address-code-review` writes `State: needs-review` after fixes and hands off — never `ready`.
- `/open-pr` requires `State: ready` when a review file exists — specifically, the `State:` line inside the **last** `## Review (...)` block in the file. A naive grep that returns the first `State:` match may pick an older block; readers must locate the final block.

## Agent Roles

- **Workflow owner**: owns the numbered workflow end-to-end. This agent may announce step completion, suggest the next workflow step, and ask whether to proceed at human-gated boundaries.
- **Specialist reviewer**: executes only the requested review or validation procedure, writes the required artifact, reports the result, and then stops. This agent does not take over the workflow.
- When the human directly asks for a review-focused command such as `review-plan`, `code-review`, or another review-only procedure, assume **specialist reviewer** mode unless the human also explicitly asks the same agent to own the workflow.
- When a review command is reached organically during the numbered workflow by the same agent already running that workflow, stay in **workflow owner** mode.
- A specialist reviewer must not suggest workflow transitions, must not ask `Proceed to Step <N>?`, and must not present itself as the implementation owner.
- A human acknowledgement ("ok", "proceed", "good") after a specialist review does **not** transfer workflow ownership to the reviewer. The reviewer's job is done; the human directs the next step themselves.

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

This workflow applies to **all code changes**, not only pre-planned features in `plan.md`. Bug fixes, ad-hoc investigations, refactors, and any user request that will result in code modifications must follow the same numbered steps, with one exception for small, unplanned work:

For unplanned work (e.g., a bug the user reports during a session, a quick chore, or a minor refactor):

- **Analysis is free.** Reading code, tracing logic, and discussing findings does not trigger the workflow.
- **The moment a code change is agreed upon**, the workflow activates.
- **Fast Track (Optional):** For minor tasks, skip formal planning and review (Steps 3, 4, 5, 8, 9) and proceed from Step 2 directly to Step 6. *Requires explicit human approval; never auto-select.*
- **plan.md updates are optional.** Mark an existing item if the fix addresses one; otherwise skip `plan.md` references in the workflow steps.
- **Rule of thumb:** If the ad-hoc task clearly matches an existing `plan.md` item, align the branch and workflow to that item. Otherwise, proceed as explicit branch-local work without forcing artificial `plan.md` linkage.

### Workflow Pacing and Discipline

- Execute the workflow strictly and sequentially. Do not spontaneously skip numbered workflow steps. Branch creation must precede planning — Step 3 documents the prerequisite and why read-only plan mode makes the order irreversible.
- Do not chain multiple distinct workflow steps together in a single turn. Pause at the logical end of your current step, report your progress via a Chat Progress Update, and await explicit human instruction before executing the next numbered phase. **Exception:** the automated pipeline (Steps 6–9) — see below.
- Human-gated boundaries are exactly: Step 5 (Plan Approving), post-Step-9 (Internal Review Fix Loop exit), Step 12 (PR Open), and Step 14 (PR Review Fix Loop exit). Step 5 and post-Step-9 use the Three-Way Approval Gate (see § `Three-Way Approval Gate`); Step 12 and Step 14 use plain handoff prompts. At these boundaries, explicitly prompt the user with the most interactive mechanism your host provides; otherwise ask directly in chat. Every other step boundary (including Step 3 → Step 4 and Step 4 → Step 5) is autonomous — flow directly, no "Proceed to Step N?" ask. Do not treat a plain status statement like "the next step is X" as sufficient handoff at the real gates; at autonomous boundaries the status statement IS the handoff. Before yielding at any boundary, make sure the current step's required save/validation work is actually complete so the next step begins from the expected repo state.
- Ask a pending human-decision question once per turn. If an intermediary progress update already asked the blocking question, do not repeat the same question verbatim in the final handoff for that same turn.
- If a step is logically irrelevant for a given task (e.g., Manual Human Testing for a pure documentation update), you must still output the `**Workflow Progress**` header for that step, formally note that it is being skipped, and provide a super concise reason why. Do not silently skip past it.
- **Automated pipeline (Steps 6–9):** Once the human approves the plan in Step 5, proceed through Implementation → Validation → Internal Review → Internal Review Fix Loop without pausing for human confirmation. Step 10 (Manual Human Testing) is the first conditional checkpoint: pause if the change is user-visible, skip automatically if not.
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

- **Make progression visible:** The human must feel the forward momentum of the workflow. At every stage boundary, explicitly announce that the current step is complete and name the next step you are moving to.
- Use the `**Workflow Progress**` header for step transitions and meaningful progress updates (e.g., entering a fix loop, pausing for testing, or completing a step).
- Do not send repeated progress updates for every small loop iteration, quick status check, or tightly-coupled follow-up command.
- In **specialist reviewer** mode, use `**Review**` or the command-specific completion header instead of `**Workflow Progress**`, report the result and artifact path, and stop. Do not add a workflow handoff or `**Next:**` line.
- *Note:* At session start (Step 1), the explicit `/check-state` snapshot command format takes precedence.

Use this format for all standard stage transitions or turn pauses:

```md
**Workflow Progress: Step <N> Complete**
- <concise summary of what was just achieved>
- <optional concise summary of the next step>

**Next:** Proceed to Step <N+1>?
```

Automated pipeline steps (see `§ Workflow Pacing and Discipline`) post the header and summary but omit the `**Next:**` line.

- Preserve the exact `**Workflow Progress**` header so the message is always visually distinct and scannable in the chat UI.

### 1. Bootstrapping

- **Not on `main`:** Treat as a resume. Run `/check-state` to establish branch reality and continue from the logically active step.
- **On `main`, dirty:** Stop. Ask the human to stash or commit before continuing.
- **On `main`, clean:** Treat as a new task. Continue to Step 2.

### 2. Workspace Preparing

- **Resuming:** Branch already exists — skip to the active step.
- **New task:** Run `/start-feature` to create the branch or worktree. Do not plan on `main`.

### 3. Plan Drafting

- **Prerequisite:** Feature branch exists (Step 2 complete).
- **Plan mode:** Activate plan mode now. Use your host's dedicated tool if one is available; otherwise ask the human to enable it and select a reasoning model before continuing. Until approved (Step 5), you may only search/read files and write to `ai/local/plans/<branch-slug>.md`. Do not modify source code or commit changes.
- **Questions:** Derive technical decisions from the codebase. For product or business decisions, ask interactively (offer 2–4 concrete options plus a free-text escape hatch) or mark the `plan.md` item `[?]` with a reason.
- **Draft:** Write a detailed, actionable plan to `ai/local/plans/<branch-slug>.md`. If no `plan.md` item applies, record explicit branch-local scope in the plan. The final section must always be `## What Will Be Available After Completion`, focused on user-facing outcomes.
- **Yield:** Post a `**Workflow Progress: Step 3 Complete**` message, then proceed directly into Step 4 (Plan Reviewing) without asking. The Step 4 review loop is autonomous; the next human gate is Step 5.

### 4. Plan Reviewing

- **Prerequisite:** Plan file exists at `ai/local/plans/<branch-slug>.md`.
- **Delegation mandate:** The review must run in a fresh-context reviewer subagent — `plan-reviewer` if defined under `.claude/agents/`, otherwise `general-purpose`. The main agent does **not** run `/review-plan` inline in Step 4; the point of delegation is fresh context and independence from the drafting path (mirror of Step 8 Phase B for code review). If the provider has no subagent primitive at all, fall back to main-agent inline execution and note it in the Step 4 summary.
- **Autonomous loop:** The loop runs without per-iteration human handoff.
  1. Main agent spawns the reviewer subagent with a short brief (plan intent, scope framing, branch-slug). Subagent executes `/review-plan` end-to-end and appends a new block to `ai/local/plans/<branch-slug>.review.md`.
  2. Main agent reads the latest block's `Recommendation:`.
  3. If `ready` → exit the loop.
  4. If `revise` → main agent runs `/address-plan-review` in the **same session** (asymmetric policy: fresh-context discovery, same-session resolution). If `/address-plan-review` surfaces `Needs User Input`, pause, await human answers, then re-run `/address-plan-review`.
  5. Main agent re-spawns the reviewer subagent for the next cycle.
  6. **Cap: 3 cycles.** If the loop does not reach `ready` after 3 subagent reviews, halt, surface the remaining findings to the human with `needs-user-input` framing, and wait for direction.
- **Exit:** Latest review block's `Recommendation:` is `ready` with no unresolved blocking findings.
- **Yield:** Post a `**Workflow Progress: Step 4 Complete**` message including the plan path, review path, and state line `reviewed | addressed | ready for human approval`, then proceed directly into the Step 5 gate without asking.

When reviewing an ad-hoc branch:
- prefer a real `plan.md` match when one exists
- if none exists, treat explicit branch-local scope as valid when the human has approved that framing
- do not block solely because no `plan.md` item matches

### Three-Way Approval Gate

Used at the two human decision points — Step 5 (Plan Approving) and post-Step-9 (Internal Review Fix Loop exit). Present three options. **Only `approve` advances the workflow.** `challenge` and `revise` keep the agent paused at the same gate — after each runs its course, the gate is re-presented for another decision.

| Option | Accept text | Agent behavior | Does it advance? |
|---|---|---|---|
| **Approve** | `1`, `approve`, `proceed`, `ok`, `go` | Continue the workflow. **Step 5 gate:** lift the Step 3 plan-mode read-only constraint, post `**Workflow Progress: Step 5 Complete**` with state line `reviewed \| addressed \| approved \| ready to implement`, transition to Step 6. **Post-Step-9 gate:** post `**Workflow Progress: Step 9 Complete**`, transition to Step 10 (or skip straight to Step 12 when the change is not user-visible per § `Workflow Pacing and Discipline`). | Yes |
| **Challenge externally** | `2`, `challenge`, `codex`, `gemini`, `external` | Pause. Instruct the human to run `/review-plan` (plan gate) or `/code-review` (code gate) from an external provider (Codex, Gemini, etc.). External provider appends a new `## Review (<provider>, <ISO>)` block per § `Commands`. External provider is reviewer-only — it never runs the fix loop. On human return signal (`done` or similar), route per **Challenge-return routing** below, then re-present the gate. | No — returns to gate |
| **Revise manually** | `3`, `revise`, `edit`, `change` | Pause. Accept either manual human edits to the plan/code or natural-language change instructions (apply them directly). After changes land, re-enter the prior review loop (Step 4 for plan gate; Step 8-9 for code gate) once to re-verify — then return to the gate. | No — returns to gate |

**Challenge-return routing.** On return from the external provider, the main agent inspects the latest appended block in the review file:
- Latest block has unresolved actionable findings, or its `Recommendation`/`State` is not `ready` → run `/address-plan-review` or `/address-code-review` in the same session, announce the updated state, and re-present the gate. **Do not re-run the internal review loop.** The external block represents a fresh-context review that already covered the artifact; addressing it is sufficient verification, and re-reviewing internally would duplicate the work the user explicitly chose to delegate externally.
- Latest block is clean (`ready`, no unchecked findings) → skip the address pass, announce "external review clean", and re-present the gate. The human can approve immediately without a pointless empty address run.

**Why Challenge and Revise differ on re-review.** Challenge ends with a *reviewed* artifact — the external provider's block is itself a fresh-context review that found either nothing or findings that `/address-*` then resolves. The reviewed-ness is preserved. Revise, by contrast, ends with *unreviewed human edits*; nobody has looked at the plan or code after the edits land. Re-entering the internal loop once closes that gap. Both paths return to the same gate, but only Revise pays the cost of re-review because only Revise leaves the artifact in an unreviewed state.

**Primitive.** Use the host's most interactive primitive (`AskUserQuestion` on Claude Code; numbered-list prompt on Codex/Gemini).

### 5. Plan Approving

- **Prerequisite:** Step 4 complete; plan state is `reviewed | addressed | ready for human approval`.
- **Gate:** Present the Three-Way Approval Gate (see § `Three-Way Approval Gate`). Discuss plan tradeoffs with the human if they raise them; technical implementation choices remain with the agent.
- **Outcome:** Handle per § `Three-Way Approval Gate`.

### 6. Implementation In Progress

- **Prerequisite:** Step 5 complete; plan-mode read-only constraint lifted.
- **Branch check:** Confirm the working directory is on the correct feature branch (`git branch --show-current`). If not, switch before writing any code.
- **Track progress:** Mark the relevant `plan.md` item `[~]` when implementation starts.
- **Implement:** Work in small, focused sub-tasks. Implement fully — no partial stubs. Keep commits scoped to one meaningful change each.
- **Re-sync:** Do not update `ai/local/plans/<branch-slug>.md` to track progress — use `git log` and `git status`. Run `/check-state` if context is lost.
- **Proceed:** Post a `**Workflow Progress: Step 6 Complete**` summary of what was implemented, then proceed directly to Step 7.

### 7. Validation Complete

- **Validate:** Execute `/validate`.
- **On failure:** Fix blocking issues and re-run `/validate`. Repeat until it passes.
- **Commit before review:** Once validation passes, commit the validated implementation snapshot before proceeding to Step 8. Internal review and any later review-fix command must start from a clean working tree that reflects the current implementation state.
- **Proceed:** Post a `**Workflow Progress: Step 7 Complete**` message, then proceed directly to Step 8.

### 8. Internal Review

Internal review has two phases: a self-pass by the main agent, then a delegated deep review by a dedicated reviewer subagent with fresh context. The main agent's context is biased toward the path it already took, so self-review alone is not sufficient for logic changes.

- **Prerequisite:** Step 7 complete, the validated implementation snapshot is committed, and the working tree is clean before review begins.

**Phase A — Self-pass (main agent).**

- Run a code quality pass on the branch diff: duplication, efficiency, unnecessary nesting. Fix what you find inline.
- This pass is cheap and benefits from full main-agent context, so it is the right place to catch obvious smells before delegating.

**Phase B — Deep review (preferred: subagent delegation; fallback: main agent inline).**

- **Path decision:** If the provider supports subagent delegation, spawn a dedicated reviewer subagent with fresh context (preferred). If not, run `/code-review` inline as the main agent and note this in the step summary.
- **Brief (both paths):** Write a short review brief (2–5 sentences) covering: the intent of the change, what is explicitly out of scope, any tradeoffs already agreed with the human, and a pointer to the relevant `plan.md` item or `ai/local/plans/<branch-slug>.md`. The brief is the single biggest lever for review quality — without one the review produces generic noise.
- **Delegated path:** Pass the brief plus the `/code-review` command logic to the subagent. The subagent owns `/code-review` end-to-end, including writing findings to `ai/local/reviews/<branch-slug>.md`. Default source is `local`; use `gh` only when you want to review what is actually in the open PR rather than local HEAD. **Verification:** before marking this step complete, confirm that `ai/local/reviews/<branch-slug>.md` exists on disk and was updated in this run — if not, the subagent did not execute `/code-review` and the step must be re-run.
- **Inline path:** Run `/code-review` directly as the main agent using the brief as context. Findings land in `ai/local/reviews/<branch-slug>.md` as usual.
- All review findings — internal and PR — must persist in this file so follow-up agents across providers can act on them without re-running the review.
- Map any provider-native subagent primitives (dedicated reviewer subagent types, isolated sub-task spawning) in the provider-specific entrypoint file, not here.
- **Proceed:** Post a `**Workflow Progress: Step 8 Complete**` message, then proceed directly to Step 9.

### Fix Loop Decision Rules

Use these rules for Internal Review Fix Loop, Manual Testing Fix Loop, and PR Review Fix Loop so the decision logic lives in one place.

| Change type | `/validate` scope | `/code-review` execution | Require human retest? |
|---|---|---|---|
| Docs, comments, text-only, narrow non-runtime refactor | `quick` | inline (main agent) | No |
| Test-only | `test` | inline (main agent) | No |
| Runtime logic, routing, persistence, BLE, native, user-visible | `full` | inline (small fix) or respawned reviewer subagent (larger fix) | Step 11/14: yes |
| Fix touches architecture, contracts, shared state, or could invalidate earlier review | `full` | respawned reviewer subagent | Step 11/14: yes |

A fix loop is clean only when the selected validation passes, no unresolved blocking review findings remain, and any required retest or PR follow-up for that stage is complete.

### 9. Internal Review Fix Loop

- If internal review finds issues, fix them before asking the human to test.
- After each review-driven code change, follow the Fix Loop Decision Rules for validation scope and review execution.
- For small incremental fixes the main agent may run `/code-review` inline since it just saw the subagent's findings and has context to verify targeted fixes. For larger fixes — or whenever the rules table says "respawned reviewer subagent" — spawn a fresh reviewer subagent with a new brief rather than reusing the main agent.
- Cap: 3 cycles. If the loop does not converge to clean after 3 fix-and-re-review cycles, halt and surface the outstanding findings to the human with `needs-user-input` framing.
- Do not proceed to the gate until the fix loop is clean.
- Once the fix loop is clean, automatically commit the resulting review-driven changes. Verify `git status --short` is clean. If no review-driven changes were needed beyond the Step 7 implementation snapshot commit, note that explicitly instead of creating an empty commit.
- **Gate:** Present the Three-Way Approval Gate.
- **Outcome:** Handle per § `Three-Way Approval Gate`.

### 10. Manual Human Testing

- **Prerequisite — clean working tree:** Before presenting the testing checklist, verify `git status --short` is empty. Any stray uncommitted changes (including whitespace-only diffs or unrelated `plan.md` edits from prior sessions) must be resolved first — either committed on this branch if they belong to the feature, stashed if they are unrelated, or reverted if they are accidental. The human should test the same state that will be reviewed and merged; untracked drift in the working tree invalidates that guarantee.
- **Not user-visible** (docs, harness, config, test-only): skip per `§ Workflow Pacing and Discipline` and proceed directly to Step 12.
- **User-visible change:** Pause and present the testing checklist. Include a concise summary of what changed and how it affects user experience or behavior. Explicitly state whether the human needs to restart Metro, rebuild the app, both, or neither.
- **Checklist:** Provide inline. For follow-up fixes, provide only incremental retest steps unless the full flow needs re-running. Do not create `ai/local/testing/<branch-slug>.md` unless the human explicitly asks.
- **Issues reported:** Proceed to Step 11.
- **Approved:** Mark the `plan.md` item `[R]` and proceed to Step 12.

### 11. Manual Testing Fix Loop

- **Entry:** Human reported issues in Step 10.
- **Fix loop:** After each fix, follow the Fix Loop Decision Rules for validation scope and review execution. Request targeted retesting only for the affected behavior.
- **Exit:** Human explicitly approves the latest changes.
- **Proceed:** Mark the `plan.md` item `[R]` and proceed to Step 12.

### 12. PR Open

- **Prerequisite:** Step 10 or 11 complete; the matching `plan.md` item is marked `[R]` when this branch maps to one.
- **Open:** Execute `/open-pr`. The command owns the `plan.md [x]` commit and push when a matching `plan.md` item exists.
- **Yield:** Post a `**Workflow Progress: Step 12 Complete**` message with the PR URL, then ask whether to proceed to Step 13.

### 13. PR Review Comments

- **Entry:** PR has incoming review comments.
- **Address:** Execute `/address-code-review` to consume and fix all actionable findings. Each fix is committed and pushed as part of the command.
- **Issues found:** Proceed to Step 14.
- **No actionable comments:** Skip Step 14 and proceed to Step 15.

### 14. PR Review Fix Loop

- **Entry:** Actionable review findings from Step 13.
- **Fix loop:** After each fix, follow the Fix Loop Decision Rules for validation scope and review execution. Request targeted manual retesting when the fix changes user-visible behavior.
- **Cap:** Repeat up to 3 cycles. If the review queue is still not clean after 3, surface the remaining findings to the human.
- **Exit:** Review queue is clean and all replies are posted.
- **Proceed:** Post a `**Workflow Progress: Step 14 Complete**` message and ask whether to proceed to Step 15.

### 15. Merge And Cleanup

- **Prerequisite:** Human confirms the PR is approved and merging should proceed.
- **Merge:** Execute `/finish-feature`. The command merges via GitHub CLI, safety-checks the workspace, removes the branch or worktree, and returns to `main`.
- **Complete:** Post a `**Workflow Progress: Step 15 Complete**` message marking the feature done.

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

**Client-specific bridges are optional per-client, mandatory per-command once adopted.** A client may wrap commands as slash-commands, skills, or whatever primitive it supports. Bridges exist purely as ergonomic sugar for the human composing prompts — they must resolve to the same canonical file, and the harness must continue to work when they are absent. Document any such bridge in the matching provider entrypoint file, never here. Do not add a bridge for a client that is not in the user's active rotation. **Once a client's bridge directory exists in the repo, every canonical command must have a matching bridge there — partial coverage is a harness bug.** Active bridge directories in this repo: `.claude/commands/<name>.md` (Claude Code), `.codex/skills/<name>/SKILL.md` (Codex), `.gemini/commands/<name>.toml` (Gemini).

**Review-family commands (`/review-plan`, `/code-review`) append provider-tagged blocks.** Each invocation appends a new `## Review (<provider>, <ISO timestamp>)` block to the review file rather than overwriting. Prior blocks, `/address-*` resolution sections, and cross-provider findings are preserved verbatim. File-level recommendation or state is read from the latest block. This is what enables the Step 5 / post-Step-9 challenge path (see § `Three-Way Approval Gate`) to accumulate reviews across providers without clobbering.

Available commands:

- `ai/commands/check-state/COMMAND.md` — bootstrap context and analyze branch reality to help decide next steps
- `ai/commands/next-task/COMMAND.md` — read plan.md, find the next unstarted task, and propose it to the user
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
2. Add a `COMMAND.md` file with YAML frontmatter (`name`, `description`, `inputs`, `outputs`).
3. Write the procedure as numbered steps with clear completion criteria.
4. Reference it from this section.
5. Mirror the command as a thin bridge in every active provider directory: `.claude/commands/<name>.md`, `.codex/skills/<name>/SKILL.md`, `.gemini/commands/<name>.toml`. Each bridge is a pointer to `ai/commands/<name>/COMMAND.md` — only the `description` field carries provider-specific picker trigger signal. Partial coverage is a harness bug.

The same mirroring rule applies when renaming or removing a command: update or delete every matching bridge in the same change.

Commands complement skills, not replace them. A command may reference a skill when domain context is needed during execution. See `ai/commands/README.md` for the full file format.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown.

If a specific AI tool requires its own config file, that file should contain only provider-specific configuration and minimal provider-specific execution notes that adapt `AGENTS.md` to that tool. Do not duplicate repository workflow instructions in full.
- If a provider supports explicit plan/edit mode APIs, use them.
- If a provider does not support agent-controlled mode switching, the workflow still requires the same plan/edit separation, but the human must perform the mode switch manually.
