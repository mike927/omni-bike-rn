# Agent Instructions

## Harness Principles

- **Single Ownership.** Every harness rule, convention, procedure, or state transition has exactly one owner. Every other reference cross-links to that owner rather than restating it.
- **Structured stops.** When the agent yields to the human for a decision, it fires the host's interactive primitive with labeled options — never a free-text wait. Three gate primitives are in use: `Three-Way Approval Gate` (plan approval), `Confirmation Gate` (testing outcome), and `Blocker Gate` (halt states). See `ai/workflow/gates.md`.
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

Branch-local work with no matching `plan.md` item skips every state transition in the workflow (`[~]`, `[R]`, `[x]`). Workflow phases still reference these marks; bypass them when no `plan.md` item applies.

## Branching And Workspace Rules

- Never commit changes directly to `main`.
- **In-Place Branching**: Standard branches (`git checkout -b <branch>`) directly in the repository root. Default for normal feature work.
- **Worktree Branching**: Dedicated worktree (`../omni-bike-rn-worktrees/<branch-slug>`) when explicitly requested for parallel isolation.
- Name branches as `<type>/<kebab-case-description>` using Conventional Commits prefixes (e.g., `feat/`, `fix/`, `docs/`, `refactor/`). Determine the prefix automatically based on task scope.

## Commit Rules

- **No Auto-Committing:** Never run `git commit` automatically after writing code or modifying files unless the human explicitly instructed you to do so. Leave the working tree dirty, report the changes, and wait for the human's next instruction. Exceptions:
  - The Implement → Review Fix Loop pipeline is pre-approved by Plan Approval; commits within it (validated snapshot, review-fix commits) run without a separate prompt.
  - `/address-code-review` commits and pushes each fix as part of its procedure — running the command is the explicit instruction.
- Use Conventional Commits; make focused commits per meaningful sub-task, not one large commit at the end.

## Workflow Artifacts

- `ai/local/plans/<branch-slug>.md`: implementation plan for the active branch. **Living document.** Edit it when scope genuinely changes during implementation; prefer `/amend-plan` so the reason is recorded alongside the change. Do **not** edit for inline discoveries that don't change overall direction — those land in the implementation, not the plan.
- `ai/local/reviews/<branch-slug>.md`: local review findings and follow-up notes for the active branch.
- Reuse the same `branch-slug` across all branch-scoped AI artifacts.
- These files are local-only and ignored by git. Do not open PRs just to add, update, or remove them.

Review file contract lives in `ai/workflow/review-file.md`.

## Agent Roles

- **Workflow owner**: owns the workflow end-to-end. May announce phase completion, suggest the next phase, and ask whether to proceed at human-gated boundaries.
- **Specialist reviewer**: executes only the requested review or validation procedure, writes the required artifact, reports the result, and then stops. Does not take over the workflow.
- When the human directly asks for a review-focused command (`review-plan`, `code-review`, or another review-only procedure), assume **specialist reviewer** mode unless they also explicitly ask the agent to own the workflow. When a review command is reached organically during the workflow by the agent already running it, stay in **workflow owner** mode.
- A specialist reviewer must not suggest workflow transitions, must not ask `Proceed to <Phase>?`, must not emit the workflow banner format (uses `**Review**` or the command-specific completion header instead), and must not present itself as the implementation owner. A human acknowledgement ("ok", "proceed", "good") after a specialist review does **not** transfer workflow ownership to the reviewer.

## Feature Workflow

### Workflow Scope

This workflow applies to **all code changes** — features, bug fixes, ad-hoc refactors, any user request that will modify code. Analysis (reading code, tracing logic, discussing findings) is free and does not trigger the workflow; the workflow activates the moment a code change is agreed upon. If the task matches an existing `plan.md` item, align the branch and workflow to it; otherwise proceed as explicit branch-local work and skip `plan.md` references — do not force artificial linkage.

**Trivial changes escape hatch.** For changes under ~50 LOC affecting ≤2 files with an obvious solution, skip the formal Plan phase — implement directly and proceed to validation. The human may also explicitly request skipping planning for larger changes. Both paths are expected, not exceptional.

### Phases

Seven phases, sequential by default, with two human gates:

| # | Phase | Gate at exit? | Summary |
|---|---|---|---|
| 1 | **Bootstrap** | no | Check state; create feature branch if new task |
| 2 | **Plan** | **Plan Approval** (Three-Way Approval Gate) | Draft plan; optionally spawn reviewer subagent for risky changes; address findings |
| 3 | **Implement** | no | Write code in focused commits; run `/validate` |
| 4 | **Review** | no | Self-pass + (optional) subagent deep review + fix loop |
| 5 | **Manual Test** | **Manual Testing Outcome** (Confirmation Gate; skipped for non-user-visible) | Present testing checklist; human tests; proceed or fix |
| 6 | **PR** | no | `/open-pr`; auto-address incoming GitHub review comments via `/address-code-review` when they arrive |
| 7 | **Merge** | no | `/finish-feature` |

**Autonomy by default.** The two gates above are the only mandatory pauses. Everywhere else the agent flows directly from one phase to the next. The Implement → Review → (Manual Test if user-visible) pipeline is pre-approved by Plan Approval.

### Rewind

Any phase can rewind to an earlier one when new information demands it:

- **Scope change** (plan was wrong or incomplete, or a new requirement emerged): invoke `/amend-plan`. It edits `ai/local/plans/<branch-slug>.md`, records the reason, and returns either to Implement (minor scope change) or to Plan (major scope change requiring re-approval).
- **Inline discovery** (small correction within existing scope): just edit the code; don't amend the plan unless overall direction shifts.

Every gate also accepts `rewind to <phase>` as an escape (see `ai/workflow/gates.md § Rewind`).

### Banner Format

Banners fire only at human-gated boundaries and at feature completion. Format: horizontal rule + H3 heading:

```
---
### ▸ <Verb> <Phase> — <subtitle>
```

Verbs:

- `Gate` — firing a human gate; interactive primitive follows immediately after the banner
- `Halted` — blocker; fires a Blocker Gate with tailored options
- `Completed` — used only for terminal feature completion (`Merge`) or when explicitly summarising a phase on demand

Do **not** emit banners at every autonomous phase transition. Prose update + tool call is the handoff. At session start, the `/check-state` snapshot takes precedence over any banner.

### Chat Headers

For substantive user-facing messages that are not banners, lead with a short purpose-based header: `**Plan**`, `**Question**`, `**Feature Summary**`, `**Manual Testing**`, `**Review**`, `**Blocked**`. Keep headers short and stable; do not invent a new header when a standard label fits.

### Fix Loop Decision Rules

Use these rules for Review, Manual Test, and PR review fix loops so the decision logic lives in one place.

| Change type | `/validate` scope | `/code-review` execution | Require human retest? |
|---|---|---|---|
| Docs, comments, text-only, narrow non-runtime refactor | `quick` | inline (main agent) | No |
| Test-only | `test` | inline (main agent) | No |
| Runtime logic, routing, persistence, BLE, native, user-visible | `full` | inline (small fix) or respawned reviewer subagent (larger fix) | Yes |
| Fix touches architecture, contracts, shared state, or could invalidate earlier review | `full` | respawned reviewer subagent | Yes |

A fix loop is clean when the selected validation passes, no unresolved blocking findings remain, and any required retest is complete. **No hard cycle cap.** If a loop genuinely isn't converging after 2–3 iterations, emit `▸ Halted <Phase>` and fire a Blocker Gate asking the human what to do.

### Plan Review Subagent Threshold

Spawn a fresh-context reviewer subagent for Plan review only when the plan touches any of:

- Native layer (`ios/`, `android/`, custom native modules)
- Database migrations or schema changes
- Routing / deep-link structure
- Shared state or cross-module contracts

For everything else, the main agent self-reviews the plan inline (or skips Plan review entirely for trivial changes).

### Workflow Detail Pointers

- **Review file contract** → `ai/workflow/review-file.md`. Load before any `/code-review`, `/address-code-review`, `/address-plan-review`, or `/open-pr` state check.
- **Gate mechanics** → `ai/workflow/gates.md`. Load before firing any gate.
- **Phase bodies** → `ai/workflow/steps.md`. Load the active phase's section when entering or resuming it.

## Skills

Use a skill when the task clearly matches that domain. Enumerate available skills on demand with `ls ai/skills/`; each `SKILL.md` carries its own `description:` frontmatter. Authoring format lives in `ai/skills/README.md`.

## Commands

Commands are active procedures for specific, repeatable tasks. They complement skills (passive reference).

- **Commands are mandatory.** When a workflow phase references a command (e.g., "run `/open-pr`"), the agent must load and follow the matching `COMMAND.md` file — never improvise or inline the procedure.
- **Resolution is by file path, not by slash picker.** Slash syntax (`/code-review`, `/validate`, etc.) is ergonomic shorthand. The contract is always `ai/commands/<name>/COMMAND.md` — load that file directly. If the canonical file cannot be read, the phase is blocked.
- **Bridges are best-effort, not strict mirrors.** Client-specific bridges must resolve to the same canonical file, and the harness must continue to work when they are absent. Active bridge directories: `.claude/commands/<name>.md`, `.codex/skills/<name>/SKILL.md`, `.gemini/commands/<name>.toml`. Add a bridge when you actively use that provider; missing bridges are a **warning, not a harness bug**. The same applies when renaming or removing a command — update the bridges you actually use.
- **Review-family commands (`/review-plan`, `/code-review`) append provider-tagged blocks** — see `ai/workflow/review-file.md` for the full append-mode contract.

Enumerate available commands on demand with `ls ai/commands/`; each `COMMAND.md` carries its own `description:` frontmatter. Authoring format lives in `ai/commands/README.md`.

## Provider-Specific Configuration

This harness is provider-agnostic. All instructions live in plain markdown. If a specific AI tool requires its own config file, that file should contain only provider-specific configuration and minimal provider-specific execution notes that adapt `AGENTS.md` to that tool — do not duplicate repository workflow instructions in full.
