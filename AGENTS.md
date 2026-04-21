# Agent Instructions

## Harness Principles

- **Single Ownership.** Every harness rule, convention, procedure, or state transition has exactly one owner. Every other reference cross-links to that owner rather than restating it.

## Core Sources

Read these in this order before feature work:

1. `plan.md`
2. This `AGENTS.md` file
3. Relevant files under `ai/skills/*/SKILL.md`
4. When the user asks for a procedure documented in `## Commands` below, load the matching `ai/commands/<name>/COMMAND.md`

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

## Branching And Workspace Rules

- Never commit changes directly to `main`.
- **In-Place Branching**: Standard branches (`git checkout -b <branch>`) directly in the repository root. Default for normal feature work.
- **Worktree Branching**: Dedicated worktree (`../omni-bike-rn-worktrees/<branch-slug>`) when explicitly requested for parallel isolation.
- Name branches as `<type>/<kebab-case-description>` using Conventional Commits prefixes (e.g., `feat/`, `fix/`, `docs/`, `refactor/`). Determine the prefix automatically based on task scope.

## Commit Rules

- **No Auto-Committing:** Never run `git commit` automatically after writing code or modifying files unless the human explicitly instructed you to do so. Leave the working tree dirty, report the changes, and wait for the human's next instruction. Exceptions:
  - The Implementation → Internal Review Fix Loop pipeline is pre-approved by Plan Approving; commits within it (validated snapshot, review-fix commits) run without a separate prompt.
  - `/address-code-review` commits and pushes each fix as part of its procedure — running the command is the explicit instruction.
- Use Conventional Commits.
- Make focused commits per meaningful sub-task, not one large commit at the end.

## Workflow Artifacts

- `ai/local/plans/<branch-slug>.md`: the local implementation plan for the active branch. Treat as a read-only blueprint once approved; do not update it continuously to track progress unless the fundamental scope changes. If the host provides a native plan tool that writes to its own location, mirror plan content to this canonical path so other providers can access it.
- `ai/local/reviews/<branch-slug>.md`: local internal review findings and follow-up notes for the active branch.
- `ai/local/testing/<branch-slug>.md`: local saved manual testing checklist. Create or update only when the human explicitly asks for a persistent checklist file.
- Reuse the same `branch-slug` across all branch-scoped AI artifacts.
- These files are local-only and ignored by git. Do not open PRs just to add, update, or remove them.

### Review File State

**Append-mode contract (single owner).** Every `/code-review` and `/review-plan` invocation appends a new `## Review (<provider>, <ISO timestamp>)` block to the review file. File-level rules:

- Never overwrite or edit prior blocks. Every run appends to the absolute end of the file, after all previous blocks and any `/address-*` resolution sections.
- The latest block wins. File-level state, recommendation, and readiness all resolve against the **last** `## Review (...)` block — readers must locate it, not grep for the first match.
- The review file has no file-level `State:` header. State lives on the `State:` line **inside** the latest block.
- Prior blocks, cross-provider findings, and `/address-*` resolution sections are preserved verbatim. This is what enables the challenge path at the two human gates (see § `Three-Way Approval Gate`) to accumulate reviews across providers without clobbering.

**State values (written inside the latest block):**

| State (latest block) | Meaning | Written by (inside that block) |
|---|---|---|
| `needs-review` | Review in progress, or fixes await re-review | `/code-review` at start of its block; `/address-code-review` when all findings are resolved |
| `needs-changes` | Latest review has unresolved actionable findings | `/code-review` |
| `ready` | Latest review is clean | `/code-review` only |

- `/code-review` is the only command that writes `State: ready` (in the block it just appended).
- `/address-code-review` writes `State: needs-review` after fixes and hands off — never `ready`.
- `/open-pr` requires `State: ready` when a review file exists — specifically, the `State:` line inside the **last** `## Review (...)` block in the file.

### Review Resolution Format

Address-family commands (`/address-plan-review`, `/address-code-review`) update findings **in place** in the review file, never moving them between sections.

- Change the checklist marker from `[ ]` to `[x]`.
- Append the resolution inline using `-> OUTCOME: <detail>`.
- Do not restructure headers or relocate items.
- Outcome verbs are command-specific (see each command's own outcome-verb table).
- `/address-plan-review` additionally appends a `## Resolution Summary` block at the end of the review file summarizing the pass. `/address-code-review` does not use this trailing block; its `State:` transition is recorded inside the latest `## Review (...)` block instead.

## Agent Roles

- **Workflow owner**: owns the numbered workflow end-to-end. This agent may announce step completion, suggest the next workflow step, and ask whether to proceed at human-gated boundaries.
- **Specialist reviewer**: executes only the requested review or validation procedure, writes the required artifact, reports the result, and then stops. This agent does not take over the workflow.
- When the human directly asks for a review-focused command such as `review-plan`, `code-review`, or another review-only procedure, assume **specialist reviewer** mode unless the human also explicitly asks the same agent to own the workflow.
- When a review command is reached organically during the numbered workflow by the same agent already running that workflow, stay in **workflow owner** mode.
- A specialist reviewer must not suggest workflow transitions, must not ask `Proceed to <StepName>?`, must not emit the workflow banner format (uses `**Review**` or the command-specific completion header instead), and must not present itself as the implementation owner.
- A human acknowledgement ("ok", "proceed", "good") after a specialist review does **not** transfer workflow ownership to the reviewer. The reviewer's job is done; the human directs the next step themselves.

## Feature Workflow

### Workflow Scope

This workflow applies to **all code changes**, not only pre-planned features in `plan.md`. Bug fixes, ad-hoc investigations, refactors, and any user request that will result in code modifications must follow the same numbered steps, with one exception for small, unplanned work:

For unplanned work (e.g., a bug the user reports during a session, a quick chore, or a minor refactor):

- **Analysis is free.** Reading code, tracing logic, and discussing findings does not trigger the workflow.
- **The moment a code change is agreed upon**, the workflow activates.
- **plan.md updates are optional.** Mark an existing item if the fix addresses one; otherwise skip `plan.md` references in the workflow steps.
- **Rule of thumb:** If the ad-hoc task clearly matches an existing `plan.md` item, align the branch and workflow to that item. Otherwise, proceed as explicit branch-local work without forcing artificial `plan.md` linkage.

For trivial fixes, the human may explicitly request skipping planning — an escape hatch, not a named track.

### Workflow Pacing and Discipline

- Execute the workflow strictly and sequentially. Do not spontaneously skip numbered workflow steps. Branch creation must precede planning — Plan Drafting documents the prerequisite and why read-only plan mode makes the order irreversible.
- Do not chain multiple distinct workflow steps together in a single turn. Pause at the logical end of your current step, emit the exit banner (see `### Banner Format` below), and await explicit human instruction before executing the next numbered phase. **Exception:** the Implementation → Internal Review Fix Loop pipeline — see below.
- Human-gated boundaries are exactly five, in workflow order:
  1. **Scope Clarification** — exit of Workspace Preparing, before Plan Drafting. Simple confirmation (see § `Confirmation Gate`).
  2. **Plan Approval** — exit of Plan Approving, after the Plan Reviewing loop converges. 3-way (see § `Three-Way Approval Gate`).
  3. **Code + Test Approval** — exit of Manual Testing / Manual Testing Fix Loop for user-visible changes, or exit of Internal Review Fix Loop for non-user-visible. 3-way.
  4. **PR Review Approval** — exit of PR Review Fix Loop (or exit of PR Review Comments when there are no actionable comments). 3-way.
  5. **Merge Approval** — entry of Merge And Cleanup, before `/finish-feature` runs. Simple confirmation.
- At every gate, the host's interactive primitive is mandatory when available; otherwise ask directly in chat. Every other step boundary is autonomous — flow directly, no "Proceed to <StepName>?" ask. At autonomous boundaries the exit banner IS the handoff. Before yielding at any boundary, make sure the current step's required save/validation work is actually complete so the next step begins from the expected repo state.
- Ask a pending human-decision question once per turn. If an intermediary progress update already asked the blocking question, do not repeat the same question verbatim in the final handoff for that same turn.
- If a step is logically irrelevant for a given task (e.g., Manual Human Testing for a pure documentation update), emit a `▸ Skipped Step N/15 — <Name>` banner with a one-line reason. Do not silently skip past it.
- **Automated pipeline (Implementation → Internal Review Fix Loop):** Once the human approves the plan at Plan Approving, proceed through Implementation → Validation → Internal Review → Internal Review Fix Loop without pausing for human confirmation. The pipeline exits into a gate: **Code + Test Approval** at the exit of Manual Testing for user-visible changes, or at the exit of Internal Review Fix Loop for non-user-visible changes. Manual Human Testing itself is the user-visible branch of that gate, not a separate checkpoint.
- Agents with terminal capabilities should run CLI commands natively instead of instructing the human to paste them, provided it stays within tool-call approval constraints.
- During complex debugging, do not pollute the project root with temporary scripts or data dumps. Use the agent's isolated sandbox directory or standard OS temporary directories (`/tmp/`), and clean them up afterward.

### Banner Format

Each workflow step emits a single banner when it finishes — a markdown horizontal rule followed by an H3 heading — so the human can see which step just closed and what happens next:

```
---
### ▸ <Verb> Step <N>/15 — <Step Name>
<one-line subtitle>
```

- **Verb** ∈ `{Completed, Gate, Halted, Skipped}`:
  - `Completed` — autonomous step completion; subtitle names the primary output.
  - `Gate` — a human-gated step boundary; the interactive primitive fires immediately after the banner. Subtitle names the question or state summary.
  - `Halted` — a fix-loop cap (3 cycles) blocks progress and surfaces `needs-user-input`; subtitle names the blocking condition.
  - `Skipped` — step never executed; subtitle is the one-line reason.
- No entry banner. The next tool call + prose IS the start signal; an explicit "Started" banner just doubled every step.
- `Step N/15` appears **only** inside this banner H3 line — never in prose. Fixed `/15` denominator.
- Subtitle shape is uniform: exactly one line, the step's primary output or state. No bullet recap — that lives in `git log` / `git status`.

| Step | Exit verb | Subtitle |
|------|-----------|----------|
| 1 Bootstrapping | Completed | `Branch: <name>` |
| 2 Workspace Preparing | Gate | `Scope Clarification — ready to draft plan?` |
| 3 Plan Drafting | Completed | `Plan: ai/local/plans/<slug>.md` |
| 4 Plan Reviewing | Completed | `Review: <path> — ready after N cycles` |
| 5 Plan Approving | Gate | `Plan Approval` |
| 6 Implementation In Progress | Completed | `Commits: <N>` |
| 7 Validation Complete | Completed | `/validate passed` |
| 8 Internal Review | Completed | `Review: <path> — N findings` |
| 9 Internal Review Fix Loop | Completed \| Gate | `N cycles, clean` (user-visible → Completed → Manual Testing; non-user-visible → Gate: `Code + Test Approval`) |
| 10 Manual Human Testing | Gate \| Skipped | `Code + Test Approval` (user-visible); skipped when non-user-visible |
| 11 Manual Testing Fix Loop | Gate | `N fixes applied — Code + Test Approval` |
| 12 PR Open | Completed | `PR: <url>` |
| 13 PR Review Comments | Completed \| Gate | `N comments addressed` (fixes needed → Completed → Fix Loop; no actionable comments → Gate: `PR Review Approval`) |
| 14 PR Review Fix Loop | Gate | `N cycles, clean — PR Review Approval` |
| 15 Merge And Cleanup | Gate → Completed | entry Gate: `Merge Approval`; exit Completed: `Merged, workspace cleaned` |

- Do not send repeated progress updates for every small loop iteration, quick status check, or tightly-coupled follow-up command.
- At session start (Bootstrapping), the explicit `/check-state` snapshot command format takes precedence over any banner — no step-completion banner fires for the bootstrap load itself.

### Chat Headers

- For substantive user-facing messages that are not workflow-step boundaries, start with a short header that tells the human what kind of message this is.
- Prefer these headers:
  - `**Plan**`
  - `**Question**`
  - `**Feature Summary**`
  - `**Manual Testing**`
  - `**Review**`
  - `**Blocked**`
- Keep headers short, stable, and purpose-based. Do not invent a new header instead of standard labels if they fit.

### 1. Bootstrapping

- **Not on `main`:** Treat as a resume. Run `/check-state` to establish branch reality and continue from the logically active step.
- **On `main`, dirty:** Stop. Ask the human to stash or commit before continuing.
- **On `main`, clean:** Treat as a new task. Continue to Workspace Preparing.

### 2. Workspace Preparing

- **Resuming:** Branch already exists — skip to the active step.
- **New task:** Run `/start-feature` to create the branch or worktree. Do not plan on `main`.
- **Gate:** Exit with the **Scope Clarification** Confirmation Gate (see § `Confirmation Gate`). Confirm the task scope is understood before investing in plan drafting; accept clarifications from the human and integrate them if requested.

### 3. Plan Drafting

- **Prerequisite:** Feature branch exists (Workspace Preparing complete).
- **Plan mode:** Activate plan mode now. Use your host's dedicated tool if one is available; otherwise ask the human to enable it and select a reasoning model before continuing. Until approved at Plan Approving, you may only search/read files and write to `ai/local/plans/<branch-slug>.md`. Do not modify source code or commit changes.
- **Questions:** Derive technical decisions from the codebase. For product or business decisions, ask interactively (offer 2–4 concrete options plus a free-text escape hatch) or mark the `plan.md` item `[?]` with a reason.
- **Draft:** Write a detailed, actionable plan to `ai/local/plans/<branch-slug>.md`. If no `plan.md` item applies, record explicit branch-local scope in the plan. The final section must always be `## What Will Be Available After Completion`, focused on user-facing outcomes.

### 4. Plan Reviewing

- **Prerequisite:** Plan file exists at `ai/local/plans/<branch-slug>.md`.
- **Delegation mandate:** The review must run in a fresh-context reviewer subagent — `plan-reviewer` if defined under `.claude/agents/`, otherwise `general-purpose`. The main agent does **not** run `/review-plan` inline during Plan Reviewing; the point of delegation is fresh context and independence from the drafting path (mirror of Internal Review Phase B for code review). If the provider has no subagent primitive at all, fall back to main-agent inline execution and note it in the exit banner subtitle.
- **Autonomous loop:** The loop runs without per-iteration human handoff.
  1. Main agent spawns the reviewer subagent with a short brief (plan intent, scope framing, branch-slug). Subagent executes `/review-plan` end-to-end and appends a new block to `ai/local/plans/<branch-slug>.review.md`.
  2. Main agent reads the latest block's `Recommendation:`.
  3. If `ready` → exit the loop.
  4. If `revise` → main agent runs `/address-plan-review` in the **same session** (asymmetric policy: fresh-context discovery, same-session resolution). If `/address-plan-review` surfaces `Needs User Input`, pause, await human answers, then re-run `/address-plan-review`.
  5. Main agent re-spawns the reviewer subagent for the next cycle.
  6. **Cap: 3 cycles.** If the loop does not reach `ready` after 3 subagent reviews, halt, surface the remaining findings to the human with `needs-user-input` framing, and wait for direction.
- **Exit:** Latest review block's `Recommendation:` is `ready` with no unresolved blocking findings.

### Three-Way Approval Gate

Used at the three review-approval points — **Plan Approval**, **Code + Test Approval**, and **PR Review Approval**. Present three options. **Only `approve` advances the workflow.** `challenge` and `revise` keep the agent paused at the same gate — after each runs its course, the gate is re-presented for another decision.

| Option | Accept text | Agent behavior | Does it advance? |
|---|---|---|---|
| **Approve** | `1`, `approve`, `proceed`, `ok`, `go` | Continue the workflow. **Plan Approval:** lift the Plan Drafting plan-mode read-only constraint and transition to Implementation In Progress. **Code + Test Approval:** transition to PR Open. **PR Review Approval:** transition to Merge Approval. | Yes |
| **Challenge externally** | `2`, `challenge`, `external` | Pause. Instruct the human to run `/review-plan` (plan gate) or `/code-review` (code or PR review gate) from a fresh context on any provider — a new session on the same provider or any other provider both qualify; the requirement is fresh context, not provider diversity. The fresh-context run appends a new `## Review (<provider>, <ISO>)` block per § `Commands`. The external reviewer is reviewer-only — it never runs the fix loop. On human return signal (`done` or similar), route per **Challenge-return routing** below, then re-present the gate. | No — returns to gate |
| **Revise manually** | `3`, `revise`, `edit`, `change` | Pause. Accept either manual human edits to the plan/code or natural-language change instructions (apply them directly). After changes land, re-enter the prior review loop (Plan Reviewing for plan gate; Internal Review → Internal Review Fix Loop for code gate; PR Review Comments → PR Review Fix Loop for PR-review gate) once to re-verify — then return to the gate. | No — returns to gate |

**Challenge-return routing.** On the human's return signal, the main agent inspects the latest appended block in the review file:
- Latest block has unresolved actionable findings, or its `Recommendation`/`State` is not `ready` → run `/address-plan-review` or `/address-code-review` in the same session, announce the updated state, and re-present the gate. **Do not re-run the internal review loop.** The fresh-context block already covered the artifact; addressing it is sufficient verification, and re-reviewing internally would duplicate the work the user explicitly chose to delegate.
- Latest block is clean (`ready`, no unchecked findings) → skip the address pass, announce "external review clean", and re-present the gate. The human can approve immediately without a pointless empty address run.

**Why Challenge and Revise differ on re-review.** Revise leaves the artifact unreviewed, so it re-enters the review loop once; Challenge ends with a fresh-context review block, so it doesn't.

**Primitive.** Use the host's interactive primitive (e.g., `AskUserQuestion`) — mandatory when available. Fall back to a numbered list in chat only when no interactive primitive exists.

### Confirmation Gate

Used at the two non-review gates — **Scope Clarification** and **Merge Approval**. A simple two-option prompt; the alternative is not "reject" but "pause for input".

| Gate | Options | Advance behavior | Pause behavior |
|---|---|---|---|
| **Scope Clarification** | `proceed` \| `clarify` | Enter Plan Drafting. | Human supplies additional scope or corrections; agent integrates the clarification, then re-presents the gate. |
| **Merge Approval** | `merge` \| `hold` | Run `/finish-feature`. | Stay at gate; human directs when to merge. |

**Primitive.** Same mandate as § `Three-Way Approval Gate` — host's interactive primitive when available, numbered-list fallback otherwise.

### 5. Plan Approving

- **Prerequisite:** Plan Reviewing complete; plan state is `reviewed | addressed | ready for human approval`.
- **Gate:** Present the **Plan Approval** Three-Way Approval Gate (see § `Three-Way Approval Gate`). Discuss plan tradeoffs with the human if they raise them; technical implementation choices remain with the agent.
- **Outcome:** Handle per § `Three-Way Approval Gate`.

### 6. Implementation In Progress

- **Prerequisite:** Plan Approving complete; plan-mode read-only constraint lifted.
- **Branch check:** Confirm the working directory is on the correct feature branch (`git branch --show-current`). If not, switch before writing any code.
- **Track progress:** Mark the relevant `plan.md` item `[~]` when implementation starts.
- **Implement:** Work in small, focused sub-tasks. Implement fully — no partial stubs. Keep commits scoped to one meaningful change each.
- **Re-sync:** Do not update `ai/local/plans/<branch-slug>.md` to track progress — use `git log` and `git status`. Run `/check-state` if context is lost.

### 7. Validation Complete

- **Validate:** Execute `/validate`.
- **On failure:** Fix blocking issues and re-run `/validate`. Repeat until it passes.
- **Commit before review:** Once validation passes, commit the validated implementation snapshot before proceeding to Internal Review. Internal review and any later review-fix command must start from a clean working tree that reflects the current implementation state.

### 8. Internal Review

Internal review has two phases: a self-pass by the main agent, then a delegated deep review by a dedicated reviewer subagent with fresh context. The main agent's context is biased toward the path it already took, so self-review alone is not sufficient for logic changes.

- **Prerequisite:** Validation Complete, the validated implementation snapshot is committed, and the working tree is clean before review begins.

**Phase A — Self-pass (main agent).**

- Run a code quality pass on the branch diff: duplication, efficiency, unnecessary nesting. Fix what you find inline.
- This pass is cheap and benefits from full main-agent context, so it is the right place to catch obvious smells before delegating.

**Phase B — Deep review (preferred: subagent delegation; fallback: main agent inline).**

- **Path decision:** If the provider supports subagent delegation, spawn a dedicated reviewer subagent with fresh context (preferred). If not, run `/code-review` inline as the main agent and note this in the exit banner subtitle.
- **Brief (both paths):** Write a short review brief (2–5 sentences) covering: the intent of the change, what is explicitly out of scope, any tradeoffs already agreed with the human, and a pointer to the relevant `plan.md` item or `ai/local/plans/<branch-slug>.md`. The brief is the single biggest lever for review quality — without one the review produces generic noise.
- **Delegated path:** Pass the brief plus the `/code-review` command logic to the subagent. The subagent owns `/code-review` end-to-end, including writing findings to `ai/local/reviews/<branch-slug>.md`. Default source is `local`; use `gh` only when you want to review what is actually in the open PR rather than local HEAD. **Verification:** before emitting the exit banner, confirm that `ai/local/reviews/<branch-slug>.md` exists on disk and was updated in this run — if not, the subagent did not execute `/code-review` and the step must be re-run.
- **Inline path:** Run `/code-review` directly as the main agent using the brief as context. Findings land in `ai/local/reviews/<branch-slug>.md` as usual.
- All review findings — internal and PR — must persist in this file so follow-up agents across providers can act on them without re-running the review.
- Map any provider-native subagent primitives (dedicated reviewer subagent types, isolated sub-task spawning) in the provider-specific entrypoint file, not here.

### Fix Loop Decision Rules

Use these rules for Internal Review Fix Loop, Manual Testing Fix Loop, and PR Review Fix Loop so the decision logic lives in one place.

| Change type | `/validate` scope | `/code-review` execution | Require human retest? |
|---|---|---|---|
| Docs, comments, text-only, narrow non-runtime refactor | `quick` | inline (main agent) | No |
| Test-only | `test` | inline (main agent) | No |
| Runtime logic, routing, persistence, BLE, native, user-visible | `full` | inline (small fix) or respawned reviewer subagent (larger fix) | Manual Testing Fix Loop / PR Review Fix Loop: yes |
| Fix touches architecture, contracts, shared state, or could invalidate earlier review | `full` | respawned reviewer subagent | Manual Testing Fix Loop / PR Review Fix Loop: yes |

A fix loop is clean only when the selected validation passes, no unresolved blocking review findings remain, and any required retest or PR follow-up for that stage is complete.

### 9. Internal Review Fix Loop

- If internal review finds issues, fix them before asking the human to test.
- After each review-driven code change, apply § `Fix Loop Decision Rules`.
- For small incremental fixes the main agent may run `/code-review` inline since it just saw the subagent's findings and has context to verify targeted fixes. For larger fixes — or whenever the rules table says "respawned reviewer subagent" — spawn a fresh reviewer subagent with a new brief rather than reusing the main agent.
- Cap: 3 cycles. If the loop does not converge to clean after 3 fix-and-re-review cycles, halt and surface the outstanding findings to the human with `needs-user-input` framing.
- Once the fix loop is clean, automatically commit the resulting review-driven changes. Verify `git status --short` is clean. If no review-driven changes were needed beyond the Validation Complete implementation snapshot commit, note that explicitly instead of creating an empty commit.
- **Exit routing:**
  - **User-visible change:** continue autonomously into Manual Human Testing. The Code + Test Approval gate fires later, at the exit of Manual Testing.
  - **Not user-visible:** fire the **Code + Test Approval** Three-Way Approval Gate here, then skip Manual Testing on approval.

### 10. Manual Human Testing

- **Prerequisite — clean working tree:** Before presenting the testing checklist, verify `git status --short` is empty. Any stray uncommitted changes (including whitespace-only diffs or unrelated `plan.md` edits from prior sessions) must be resolved first — either committed on this branch if they belong to the feature, stashed if they are unrelated, or reverted if they are accidental. The human should test the same state that will be reviewed and merged; untracked drift in the working tree invalidates that guarantee.
- **Not user-visible** (docs, harness, config, test-only): skipped per Step 9's exit routing; the Code + Test Approval gate already fired there.
- **User-visible change:** Pause and present the testing checklist. Include a concise summary of what changed and how it affects user experience or behavior. Explicitly state whether the human needs to restart Metro, rebuild the app, both, or neither.
- **Checklist:** Provide inline. For follow-up fixes, provide only incremental retest steps unless the full flow needs re-running. Do not create `ai/local/testing/<branch-slug>.md` unless the human explicitly asks.
- **Issues reported:** Proceed to Manual Testing Fix Loop.
- **Approved:** Mark the `plan.md` item `[R]`, then fire the **Code + Test Approval** Three-Way Approval Gate before proceeding to PR Open.

### 11. Manual Testing Fix Loop

- **Entry:** Human reported issues in Manual Human Testing.
- **Fix loop:** Apply § `Fix Loop Decision Rules`. Request targeted retesting only for the affected behavior.
- **Exit:** Human explicitly approves the latest changes; mark the `plan.md` item `[R]`, then fire the **Code + Test Approval** Three-Way Approval Gate (see Step 10).

### 12. PR Open

- **Prerequisite:** Manual Human Testing or Manual Testing Fix Loop complete; the matching `plan.md` item is marked `[R]` when this branch maps to one.
- **Open:** Execute `/open-pr`. The command owns the `plan.md [x]` commit and push when a matching `plan.md` item exists.

### 13. PR Review Comments

- **Entry:** PR has incoming review comments.
- **Address:** Execute `/address-code-review` to consume and fix all actionable findings. Each fix is committed and pushed as part of the command.
- **Issues found:** Proceed to PR Review Fix Loop.
- **No actionable comments:** Skip PR Review Fix Loop; fire the **PR Review Approval** Three-Way Approval Gate directly.

### 14. PR Review Fix Loop

- **Entry:** Actionable review findings from PR Review Comments.
- **Fix loop:** Apply § `Fix Loop Decision Rules`. Request targeted manual retesting when the fix changes user-visible behavior.
- **Cap:** Repeat up to 3 cycles. If the review queue is still not clean after 3, surface the remaining findings to the human.
- **Exit:** Review queue is clean and all replies are posted, then fire the **PR Review Approval** Three-Way Approval Gate before proceeding to Merge And Cleanup.

### 15. Merge And Cleanup

- **Gate:** Fire the **Merge Approval** Confirmation Gate (see § `Confirmation Gate`) at the start of this step. The human confirms the PR is approved on GitHub and merging should proceed now.
- **Merge:** On approval, execute `/finish-feature`. The command merges via GitHub CLI, safety-checks the workspace, removes the branch or worktree, and returns to `main`.

## Skills

Use a skill when the task clearly matches that domain. Enumerate available skills on demand with `ls ai/skills/`; each `SKILL.md` carries its own `description:` frontmatter.

### Adding A New Skill

1. Create a folder at `ai/skills/<skill-name>/`.
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`).
3. Write domain-specific content: context, key files, patterns, known issues.

## Commands

Commands are active procedures for specific, repeatable tasks. They complement skills (passive reference).

**Commands are mandatory.** When a workflow step references a command (e.g., "Execute the `/open-pr` command logic"), the agent must load and follow the matching `COMMAND.md` file — never improvise or inline the procedure. This applies whether triggered by the human or reached organically during the workflow.

**Resolution is by file path, not by slash picker.** Slash syntax (`/code-review`, `/validate`, etc.) is ergonomic shorthand used throughout this document. The contract is always `ai/commands/<name>/COMMAND.md` — load that file directly. Do not depend on your client's command picker to surface the command; discoverability varies per client and some clients surface nothing at all. If the canonical file cannot be read, the step is blocked.

**Client-specific bridges are optional per-client, mandatory per-command once adopted.** A client may wrap commands as slash-commands, skills, or whatever primitive it supports. Bridges exist purely as ergonomic sugar for the human composing prompts — they must resolve to the same canonical file, and the harness must continue to work when they are absent. Document any such bridge in the matching provider entrypoint file, never here. Do not add a bridge for a client that is not in the user's active rotation. **Once a client's bridge directory exists in the repo, every canonical command must have a matching bridge there — partial coverage is a harness bug.** Active bridge directories in this repo: `.claude/commands/<name>.md` (Claude Code), `.codex/skills/<name>/SKILL.md` (Codex), `.gemini/commands/<name>.toml` (Gemini).

**Review-family commands (`/review-plan`, `/code-review`) append provider-tagged blocks.** Each invocation appends a new `## Review (<provider>, <ISO timestamp>)` block to the review file rather than overwriting. Prior blocks, `/address-*` resolution sections, and cross-provider findings are preserved verbatim. File-level recommendation or state is read from the latest block. This is what enables the Plan Approving / post-Internal Review Fix Loop challenge path (see § `Three-Way Approval Gate`) to accumulate reviews across providers without clobbering.

Enumerate available commands on demand with `ls ai/commands/`; each `COMMAND.md` carries its own `description:` frontmatter.

### Adding A New Command

1. Create a folder at `ai/commands/<command-name>/`.
2. Add a `COMMAND.md` file with YAML frontmatter (`name`, `description`, `inputs`, `outputs`).
3. Write the procedure as numbered steps with clear completion criteria.
4. Mirror the command as a thin bridge in every active provider directory: `.claude/commands/<name>.md`, `.codex/skills/<name>/SKILL.md`, `.gemini/commands/<name>.toml`. Each bridge is a pointer to `ai/commands/<name>/COMMAND.md` — only the `description` field carries provider-specific picker trigger signal. Partial coverage is a harness bug.

The same mirroring rule applies when renaming or removing a command: update or delete every matching bridge in the same change.

See `ai/commands/README.md` for the full file format.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown.

If a specific AI tool requires its own config file, that file should contain only provider-specific configuration and minimal provider-specific execution notes that adapt `AGENTS.md` to that tool. Do not duplicate repository workflow instructions in full.
