# Agent Instructions

## Harness Principles

- **Single Ownership.** Every harness rule, convention, procedure, or state transition has exactly one owner. Every other reference cross-links to that owner rather than restating it.
- **Structured stops.** Whenever the agent yields to the human for a decision, input, or unblock, it fires the host's interactive primitive with labeled options — never a free-text wait. The three gate primitives are `Three-Way Approval Gate` (review approvals), `Confirmation Gate` (simple binary choices), and `Blocker Gate` (fix-loop caps, prereq failures, unresolved questions) — see `ai/workflow/gates.md`. "Present something and wait for the human to respond in prose" is not a valid pause.
- **Cross-reference convention.** Within a single file, reference other sections as bare `§ Section Name`. Across files, always file-qualify: `AGENTS.md § Section` or `ai/workflow/<file>.md § Section`. Never bare `§` across file boundaries.

## Core Sources

Read these in this order before feature work:

1. `plan.md`
2. This `AGENTS.md` file
3. Relevant files under `ai/skills/*/SKILL.md`
4. When the user asks for a procedure documented in § `Commands` below, load the matching `ai/commands/<name>/COMMAND.md`

`plan.md` is the single source of truth for tracked project scope and progress; some approved ad-hoc branch-local work may proceed without being added there. `branch-slug` means the branch name with `/` replaced by `-`.

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
- Use Conventional Commits; make focused commits per meaningful sub-task, not one large commit at the end.

## Workflow Artifacts

- `ai/local/plans/<branch-slug>.md`: the local implementation plan for the active branch. Treat as a read-only blueprint once approved; do not update it continuously to track progress unless the fundamental scope changes. If the host provides a native plan tool that writes to its own location, mirror plan content to this canonical path so other providers can access it.
- `ai/local/reviews/<branch-slug>.md`: local internal review findings and follow-up notes for the active branch.
- Reuse the same `branch-slug` across all branch-scoped AI artifacts.
- These files are local-only and ignored by git. Do not open PRs just to add, update, or remove them.

Review file contract (append-mode, state values, resolution format) lives in `ai/workflow/review-file.md`.

## Agent Roles

- **Workflow owner**: owns the numbered workflow end-to-end. This agent may announce step completion, suggest the next workflow step, and ask whether to proceed at human-gated boundaries.
- **Specialist reviewer**: executes only the requested review or validation procedure, writes the required artifact, reports the result, and then stops. This agent does not take over the workflow.
- When the human directly asks for a review-focused command (`review-plan`, `code-review`, or another review-only procedure), assume **specialist reviewer** mode unless they also explicitly ask the agent to own the workflow. When a review command is reached organically during the numbered workflow by the agent already running it, stay in **workflow owner** mode.
- A specialist reviewer must not suggest workflow transitions, must not ask `Proceed to <StepName>?`, must not emit the workflow banner format (uses `**Review**` or the command-specific completion header instead), and must not present itself as the implementation owner. A human acknowledgement ("ok", "proceed", "good") after a specialist review does **not** transfer workflow ownership to the reviewer — the reviewer's job is done; the human directs the next step themselves.

## Feature Workflow

### Workflow Scope

This workflow applies to **all code changes** — features, bug fixes, ad-hoc refactors, any user request that will modify code. Analysis (reading code, tracing logic, discussing findings) is free and does not trigger the workflow; the workflow activates the moment a code change is agreed upon. If the task matches an existing `plan.md` item, align the branch and workflow to it; otherwise proceed as explicit branch-local work and skip `plan.md` references in the workflow steps — do not force artificial linkage. For trivial fixes, the human may explicitly request skipping planning — an escape hatch, not a named track.

### Workflow Pacing and Discipline

- Execute the workflow strictly and sequentially. Do not spontaneously skip numbered workflow steps. Branch creation must precede planning — Plan Drafting documents the prerequisite and why read-only plan mode makes the order irreversible.
- Do not chain multiple distinct workflow steps together in a single turn. Pause at the logical end of your current step, emit the exit banner (see § `Banner Format`), and await explicit human instruction before executing the next numbered phase. **Exception:** the Implementation → Internal Review Fix Loop pipeline runs autonomously end-to-end once the plan is approved.
- Human-gated boundaries are exactly five, in workflow order:
  1. **Scope Clarification** — exit of Workspace Preparing, before Plan Drafting. Confirmation Gate.
  2. **Plan Approval** — exit of Plan Approving, after the Plan Reviewing loop converges. Three-Way Approval Gate.
  3. **Manual Testing Outcome** — exit of Manual Human Testing for user-visible changes, after the agent presents the testing checklist and the human runs it. Confirmation Gate: `proceed` (routes to PR Open) or `address issues` (routes to Manual Testing Fix Loop). Skipped entirely for non-user-visible changes.
  4. **PR Review Approval** — entry of PR Review Comments, once the PR has incoming review comments (or no actionable comments and the review cycle is trivially clean). Three-Way Approval Gate.
  5. **Merge Approval** — entry of Merge And Cleanup, before `/finish-feature` runs. Confirmation Gate.
- Internal Review Fix Loop and Manual Testing Fix Loop finish autonomously — no Three-Way Approval Gate fires between internal review and PR Open. The user-visible Manual Testing pause is structured as the Manual Testing Outcome Confirmation Gate above, not a free-text wait.
- At every gate, the host's interactive primitive is mandatory when available; otherwise ask directly in chat. Every other step boundary is autonomous — flow directly, no "Proceed to <StepName>?" ask. At autonomous boundaries the exit banner IS the handoff. Before yielding at any boundary, make sure the current step's required save/validation work is actually complete so the next step begins from the expected repo state. Ask a pending human-decision question once per turn; do not repeat the same blocking question verbatim in the final handoff if an intermediary update already asked it.
- If a step is logically irrelevant for a given task (e.g., Manual Human Testing for a pure documentation update), emit a `▸ Skipped Step N/15 — <Name>` banner with a one-line reason. Do not silently skip past it.
- Agents with terminal capabilities should run CLI commands natively instead of instructing the human to paste them, within tool-call approval constraints. During complex debugging, do not pollute the project root with temporary scripts or data dumps — use the agent's isolated sandbox or `/tmp/`, and clean up afterward.

### Banner Format

Each workflow step emits a single banner when it finishes — a markdown horizontal rule followed by an H3 heading — so the human can see which step just closed and what happens next:

```
---
### ▸ <Verb> Step <N>/15 — <Step Name>
<one-line subtitle>
```

- **Verb** ∈ `{Completed, Gate, Halted, Skipped}`. Verb definitions live in `ai/workflow/steps.md § Banner Verbs`.
- No entry banner — the next tool call + prose IS the start signal. `Step N/15` appears **only** inside this banner H3 line, never in prose. Subtitle is exactly one line naming the step's primary output or state; no bullet recap (that lives in `git log` / `git status`).

| Step | Exit verb | Subtitle |
|------|-----------|----------|
| 1 Bootstrapping | Completed | `Branch: <name>` |
| 2 Workspace Preparing | Gate | `Scope Clarification` |
| 3 Plan Drafting | Completed | `Plan: ai/local/plans/<slug>.md` |
| 4 Plan Reviewing | Completed | `Review: <path> — ready after N cycles` |
| 5 Plan Approving | Gate | `Plan Approval` |
| 6 Implementation In Progress | Completed | `Commits: <N>` |
| 7 Validation Complete | Completed | `/validate passed` |
| 8 Internal Review | Completed | `Review: <path> — N findings` |
| 9 Internal Review Fix Loop | Completed | `N cycles, clean` |
| 10 Manual Human Testing | Gate \| Skipped | `Manual Testing Outcome` (user-visible); skipped when non-user-visible |
| 11 Manual Testing Fix Loop | Gate | `Manual Testing Outcome` (re-presented after fixes) |
| 12 PR Open | Completed | `PR: <url>` |
| 13 PR Review Comments | Gate | `PR Review Approval` |
| 14 PR Review Fix Loop | Completed | `N cycles, clean` |
| 15 Merge And Cleanup | Gate → Completed | entry Gate: `Merge Approval`; exit Completed: `Merged, workspace cleaned` |

- Do not send repeated progress updates for every small loop iteration, quick status check, or tightly-coupled follow-up command. At session start (Bootstrapping), the explicit `/check-state` snapshot command format takes precedence over any banner — no step-completion banner fires for the bootstrap load itself.

### Chat Headers

For substantive user-facing messages that are not workflow-step boundaries, start with a short purpose-based header. Preferred: `**Plan**`, `**Question**`, `**Feature Summary**`, `**Manual Testing**`, `**Review**`, `**Blocked**`. Keep headers short and stable; do not invent a new header when a standard label fits.

### Fix Loop Decision Rules

Use these rules for Internal Review Fix Loop, Manual Testing Fix Loop, and PR Review Fix Loop so the decision logic lives in one place.

| Change type | `/validate` scope | `/code-review` execution | Require human retest? |
|---|---|---|---|
| Docs, comments, text-only, narrow non-runtime refactor | `quick` | inline (main agent) | No |
| Test-only | `test` | inline (main agent) | No |
| Runtime logic, routing, persistence, BLE, native, user-visible | `full` | inline (small fix) or respawned reviewer subagent (larger fix) | Manual Testing Fix Loop / PR Review Fix Loop: yes |
| Fix touches architecture, contracts, shared state, or could invalidate earlier review | `full` | respawned reviewer subagent | Manual Testing Fix Loop / PR Review Fix Loop: yes |

A fix loop is clean only when the selected validation passes, no unresolved blocking review findings remain, and any required retest or PR follow-up for that stage is complete.

### Workflow Detail Pointers

- **Review file contract** → `ai/workflow/review-file.md`. Load before any `/code-review`, `/address-code-review`, `/address-plan-review`, or `/open-pr` state check.
- **Gate mechanics** → `ai/workflow/gates.md`. Load before firing any gate.
- **Step bodies** → `ai/workflow/steps.md`. Load the active step's section when entering or resuming it.

## Skills

Use a skill when the task clearly matches that domain. Enumerate available skills on demand with `ls ai/skills/`; each `SKILL.md` carries its own `description:` frontmatter. Authoring format lives in `ai/skills/README.md`.

## Commands

Commands are active procedures for specific, repeatable tasks. They complement skills (passive reference).

- **Commands are mandatory.** When a workflow step references a command (e.g., "Execute the `/open-pr` command logic"), the agent must load and follow the matching `COMMAND.md` file — never improvise or inline the procedure. This applies whether triggered by the human or reached organically during the workflow.
- **Resolution is by file path, not by slash picker.** Slash syntax (`/code-review`, `/validate`, etc.) is ergonomic shorthand. The contract is always `ai/commands/<name>/COMMAND.md` — load that file directly. If the canonical file cannot be read, the step is blocked.
- **Client-specific bridges are optional per-client, mandatory per-command once adopted.** Bridges must resolve to the same canonical file, and the harness must continue to work when they are absent. Document any such bridge in the matching provider entrypoint file, never here. **Once a client's bridge directory exists in the repo, every canonical command must have a matching bridge there — partial coverage is a harness bug.** Active bridge directories: `.claude/commands/<name>.md`, `.codex/skills/<name>/SKILL.md`, `.gemini/commands/<name>.toml`. The same mirroring rule applies when renaming or removing a command: update or delete every matching bridge in the same change.
- **Review-family commands (`/review-plan`, `/code-review`) append provider-tagged blocks** — see `ai/workflow/review-file.md § Review File State` for the full append-mode contract.

Enumerate available commands on demand with `ls ai/commands/`; each `COMMAND.md` carries its own `description:` frontmatter. Authoring format lives in `ai/commands/README.md`.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown. If a specific AI tool requires its own config file, that file should contain only provider-specific configuration and minimal provider-specific execution notes that adapt `AGENTS.md` to that tool — do not duplicate repository workflow instructions in full.
