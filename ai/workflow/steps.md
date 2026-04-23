# Phase Bodies

This file is a chunked continuation of `AGENTS.md`. The spine owns the anchor; do not add new workflow policy here without adding its trigger to the spine.

Anchor in spine: `AGENTS.md § Phases` owns the 7-phase table and the two human gates. This file expands each phase into its concrete prerequisites, actions, and exit conditions.

## Banner Verbs

`Verb` ∈ `{Gate, Halted, Completed}`:

- `Gate` — a human-gated boundary; the interactive primitive fires immediately after the banner. Subtitle names the gate.
- `Halted` — a blocker or non-converging loop; fires a Blocker Gate immediately after the banner. Subtitle names the blocking condition.
- `Completed` — reserved for terminal feature completion (`Merge`) or explicit on-demand summaries.

Autonomous phase transitions do not emit banners — the next tool call + prose IS the handoff.

## 1. Bootstrap

Consolidates the old Bootstrapping + Workspace Preparing steps.

- **Not on `main`:** Treat as a resume. Run `/check-state` to establish branch reality and continue from the logically active phase.
- **On `main`, dirty:** Fire a Blocker Gate (see `ai/workflow/gates.md § Blocker Gate`) — typically `stash` / `commit to a new branch` / `discard` / `abort`.
- **On `main`, clean, new task:** Run `/start-feature` to create the branch (or worktree when explicitly requested). Do not plan on `main`.
- **Exit:** Autonomous. Flow directly into Plan. No banner; no gate at this boundary.

## 2. Plan

Consolidates the old Plan Drafting + Plan Reviewing + Plan Approving steps. One phase, one gate at the exit.

- **Prerequisite:** Feature branch exists.
- **Plan mode:** Activate plan mode now. Use the host's dedicated tool if available; otherwise explicitly constrain yourself to search/read + writing `ai/local/plans/<branch-slug>.md`. Do not modify source code until the gate releases.
- **Trivial changes escape hatch:** If the task is under ~50 LOC affecting ≤2 files with an obvious solution, skip this phase entirely — no plan file, no gate — and flow directly to Implement. The human may also explicitly request skipping.
- **Draft:** Write an actionable plan to `ai/local/plans/<branch-slug>.md`. If no `plan.md` item applies, record explicit branch-local scope. The final section must always be `## What Will Be Available After Completion`.
- **Questions:** For technical decisions, derive from the codebase. For product/business decisions, fire a Blocker Gate with 2–4 concrete mutually-exclusive options. If the human defers, mark the `plan.md` item `[?]` instead of guessing.
- **Review (conditional):** If the plan touches the native layer, DB migrations, routing, or shared contracts (see `AGENTS.md § Plan Review Subagent Threshold`), spawn a fresh-context reviewer subagent to run `/review-plan`. Read its `Recommendation:` and run `/address-plan-review` in the same session if it returns `revise`. Otherwise skip — the main agent self-reviews the plan inline before presenting it.
- **No hard cycle cap.** If address → re-review doesn't converge after 2–3 iterations, fire a Blocker Gate asking the human what to do.
- **Gate:** Present the **Plan Approval** Three-Way Approval Gate (see `ai/workflow/gates.md § Three-Way Approval Gate`).
  - `Approve` → lift plan-mode read-only constraint; flow to Implement.
  - `Challenge externally` → pause for a fresh-context `/review-plan` on any provider, then return to the gate.
  - `Revise manually` → accept edits or NL instructions; re-verify; return to the gate.

## 3. Implement

Consolidates the old Implementation In Progress + Validation Complete steps.

- **Prerequisite:** Plan Approval complete (or plan phase skipped per trivial-change rule); plan-mode read-only lifted.
- **Branch check:** Confirm `git branch --show-current` is the feature branch. Switch first if not.
- **Track progress:** Mark the matching `plan.md` item `[~]` when implementation starts (skip for branch-local work).
- **Implement:** Work in small, focused sub-tasks. No partial stubs. Commits scoped to one meaningful change each.
- **Do not edit the plan** to track progress — use `git log` and `git status`. Run `/check-state` if context is lost.
- **Inline discoveries:** small corrections within existing scope go into the implementation, not into the plan.
- **Scope change mid-implementation:** if a genuine scope change emerges, invoke `/amend-plan`. It updates the plan with a scope-change reason and returns either to Implement (minor) or to Plan (major).
- **Validate:** Run `/validate` once implementation is substantively complete. Fix blocking issues and re-run until it passes.
- **Commit the validated snapshot.** Review starts from a clean working tree.
- **Exit:** Autonomous. Flow to Review.

## 4. Review

Consolidates the old Internal Review + Internal Review Fix Loop steps.

- **Prerequisite:** Validate passed; validated implementation committed; working tree clean.

**Phase A — Self-pass (main agent).**

- Run a code quality pass on the branch diff: duplication, efficiency, unnecessary nesting. Fix what you find inline.
- Cheap, benefits from full main-agent context, catches obvious smells before delegating.

**Phase B — Deep review (subagent preferred; main-agent inline fallback).**

- **Path decision:** If the provider supports subagent delegation, spawn a dedicated reviewer subagent with fresh context (preferred). If not, run `/code-review` inline as the main agent.
- **Brief (both paths):** Write a short review brief (2–5 sentences): intent of the change, explicit out-of-scope items, tradeoffs already agreed with the human, pointer to the relevant `plan.md` item or plan file. Without a brief the review produces generic noise.
- **Delegated path:** Pass the brief + `/code-review` command logic to the subagent. Subagent writes findings to `ai/local/reviews/<branch-slug>.md`. Verify the file was updated before continuing.
- **Inline path:** Run `/code-review` directly with the brief as context. Findings land in the same file.

**Fix loop.**

- For each finding, apply `AGENTS.md § Fix Loop Decision Rules` (validate scope, who re-reviews, retest required).
- Small incremental fixes: main agent re-runs `/code-review` inline. Larger fixes or architecture-touching: respawn the reviewer subagent with a fresh brief.
- **No hard cycle cap.** If the loop isn't converging after 2–3 cycles, emit `▸ Halted Review` and fire a Blocker Gate — typically `retry one more cycle` / `accept partial state and continue` / `abort workflow`.
- Once clean, automatically commit the review-driven changes. If no review-driven changes were needed beyond the validation snapshot, note that explicitly instead of creating an empty commit.
- **Exit:** Autonomous. For user-visible changes, flow to Manual Test. For non-user-visible changes, skip Manual Test and flow directly to PR.

## 5. Manual Test

Consolidates the old Manual Human Testing + Manual Testing Fix Loop steps. Only fires for user-visible changes.

- **Prerequisite — clean working tree:** `git status --short` must be empty before presenting the checklist. Stray uncommitted changes (whitespace, unrelated `plan.md` edits) must be resolved first. The human should test the same state that will be reviewed and merged.
- **Not user-visible:** skipped; continue to PR.
- **Present the checklist:** include a concise summary of what changed and how it affects UX. Explicitly state whether Metro restart, rebuild, both, or neither is required. Provide only incremental retest steps on fix re-entries.
- **Gate:** Fire the **Manual Testing Outcome** Confirmation Gate (see `ai/workflow/gates.md § Confirmation Gate`).
  - `proceed` → mark `plan.md` item `[R]`; flow to PR.
  - `address issues` → enter the fix loop; apply `AGENTS.md § Fix Loop Decision Rules`; after the fix lands and the human re-tests, re-present this same gate.

## 6. PR

Consolidates the old PR Open + PR Review Comments + PR Review Fix Loop steps.

- **Prerequisite:** Manual Test complete (or skipped); `plan.md` item marked `[R]` when applicable.
- **Open:** Run `/open-pr`. The command owns the `plan.md [x]` commit and push when a matching item exists.
- **Incoming review comments:** when GitHub review comments arrive (or a fresh external review block is appended to `ai/local/reviews/<branch-slug>.md`), run `/address-code-review` autonomously. It consumes review threads, fixes each actionable finding, commits, pushes, and cycles through the fix loop until the review queue is clean.
- **No PR review gate.** The PR phase is autonomous by design (solo workflow); the human can always interject in chat or directly on GitHub to redirect.
- **No hard cycle cap.** If `/address-code-review` isn't converging, emit `▸ Halted PR` and fire a Blocker Gate.
- **Exit:** Autonomous. Flow to Merge when the review queue is clean and CI is green.

## 7. Merge

Consolidates the old Merge And Cleanup step.

- **Prerequisite:** PR is approved on GitHub, CI is green, working tree clean.
- **Merge:** Run `/finish-feature`. The command merges via `gh`, safety-checks the workspace, removes the branch or worktree, and returns to `main`.
- **Exit:** Emit a single `▸ Completed Merge — <PR URL>` banner when the command finishes successfully. This is the only `Completed` banner in the normal flow.

## Rewind Between Phases

Rewinds are legal moves, not errors. Two mechanisms:

- **`/amend-plan`** — from any phase post-Plan, invoke this command to update the plan file with a scope-change entry and return to Implement (minor change) or Plan (major change). See `ai/commands/amend-plan/COMMAND.md`.
- **Gate `rewind` option** — at Plan Approval or Manual Testing Outcome, the human can choose `rewind to <phase>` instead of the standard options. See `ai/workflow/gates.md § Rewind`.

Prefer `/amend-plan` when the issue is that the plan was wrong. Prefer the gate `rewind` when the phase itself produced something that needs undoing (e.g., tests revealed the wrong feature was built).
