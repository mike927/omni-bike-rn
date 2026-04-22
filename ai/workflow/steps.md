# Workflow Step Bodies

This file is a chunked continuation of `AGENTS.md`. The spine owns the anchor; do not add new workflow policy here without adding its trigger to the spine.

Anchor in spine: `AGENTS.md § Banner Format` carries the 15-row exit-verb table — the canonical index of which step fires which banner. Load the relevant section of this file when entering or resuming a specific step.

## Banner Verbs

`Verb` ∈ `{Completed, Gate, Halted, Skipped}`:

- `Completed` — autonomous step completion; subtitle names the primary output.
- `Gate` — a human-gated step boundary; the interactive primitive fires immediately after the banner. Subtitle names the question or state summary.
- `Halted` — a fix-loop cap, prereq failure, or other block; subtitle names the blocking condition. Fires a `Blocker Gate` (see `ai/workflow/gates.md § Blocker Gate`) immediately after the banner.
- `Skipped` — step never executed; subtitle is the one-line reason.

## 1. Bootstrapping

- **Not on `main`:** Treat as a resume. Run `/check-state` to establish branch reality and continue from the logically active step.
- **On `main`, dirty:** Emit the `▸ Halted Step 1/15 — Bootstrapping` banner and fire a `Blocker Gate` (see `ai/workflow/gates.md § Blocker Gate`) — typically `stash` / `commit to a new branch` / `discard` / `abort`.
- **On `main`, clean:** Treat as a new task. Continue to Workspace Preparing.

## 2. Workspace Preparing

- **Resuming:** Branch already exists — skip to the active step.
- **New task:** Run `/start-feature` to create the branch or worktree. Do not plan on `main`.
- **Gate:** Exit with the **Scope Clarification** Confirmation Gate (see `ai/workflow/gates.md § Confirmation Gate`). Confirm the task scope is understood before investing in plan drafting; accept clarifications from the human and integrate them if requested.

## 3. Plan Drafting

- **Prerequisite:** Feature branch exists (Workspace Preparing complete).
- **Plan mode:** Activate plan mode now. Use your host's dedicated tool if one is available; otherwise ask the human to enable it and select a reasoning model before continuing. Until approved at Plan Approving, you may only search/read files and write to `ai/local/plans/<branch-slug>.md`. Do not modify source code or commit changes.
- **Questions:** Derive technical decisions from the codebase. For product or business decisions, fire a `Blocker Gate` (see `ai/workflow/gates.md § Blocker Gate`) with 2–4 concrete mutually-exclusive answers to the specific question (the host's primitive always adds an `Other` / free-text escape). If the human defers, mark the `plan.md` item `[?]` with a reason instead of guessing.
- **Draft:** Write a detailed, actionable plan to `ai/local/plans/<branch-slug>.md`. If no `plan.md` item applies, record explicit branch-local scope in the plan. The final section must always be `## What Will Be Available After Completion`, focused on user-facing outcomes.

## 4. Plan Reviewing

- **Prerequisite:** Plan file exists at `ai/local/plans/<branch-slug>.md`.
- **Delegation mandate:** The review must run in a fresh-context reviewer subagent — `plan-reviewer` if defined under `.claude/agents/`, otherwise `general-purpose`. The main agent does **not** run `/review-plan` inline during Plan Reviewing; the point of delegation is fresh context and independence from the drafting path (mirror of Internal Review Phase B for code review). If the provider has no subagent primitive at all, fall back to main-agent inline execution and note it in the exit banner subtitle.
- **Autonomous loop:** The loop runs without per-iteration human handoff.
  1. Main agent spawns the reviewer subagent with a short brief (plan intent, scope framing, branch-slug). Subagent executes `/review-plan` end-to-end and appends a new block to `ai/local/plans/<branch-slug>.review.md`.
  2. Main agent reads the latest block's `Recommendation:`.
  3. If `ready` → exit the loop.
  4. If `revise` → main agent runs `/address-plan-review` in the **same session** (asymmetric policy: fresh-context discovery, same-session resolution). If `/address-plan-review` surfaces `Needs User Input`, pause, await human answers, then re-run `/address-plan-review`.
  5. Main agent re-spawns the reviewer subagent for the next cycle.
  6. **Cap: 3 cycles.** If the loop does not reach `ready` after 3 subagent reviews, emit the `▸ Halted Step 4/15 — Plan Reviewing` banner with a one-line subtitle naming the blocking findings, then fire a `Blocker Gate` (see `ai/workflow/gates.md § Blocker Gate`) with tailored options (typically `retry one more cycle` / `accept partial state and advance to Plan Approving with known gaps` / `abort workflow`).
- **Exit:** Latest review block's `Recommendation:` is `ready` with no unresolved blocking findings.

## 5. Plan Approving

- **Prerequisite:** Plan Reviewing complete; plan state is `reviewed | addressed | ready for human approval`.
- **Gate:** Present the **Plan Approval** Three-Way Approval Gate (see `ai/workflow/gates.md § Three-Way Approval Gate`). Discuss plan tradeoffs with the human if they raise them; technical implementation choices remain with the agent.
- **Outcome:** Handle per `ai/workflow/gates.md § Three-Way Approval Gate`.

## 6. Implementation In Progress

- **Prerequisite:** Plan Approving complete; plan-mode read-only constraint lifted.
- **Branch check:** Confirm the working directory is on the correct feature branch (`git branch --show-current`). If not, switch before writing any code.
- **Track progress:** Mark the relevant `plan.md` item `[~]` when implementation starts.
- **Implement:** Work in small, focused sub-tasks. Implement fully — no partial stubs. Keep commits scoped to one meaningful change each.
- **Re-sync:** Do not update `ai/local/plans/<branch-slug>.md` to track progress — use `git log` and `git status`. Run `/check-state` if context is lost.

## 7. Validation Complete

- **Validate:** Execute `/validate`.
- **On failure:** Fix blocking issues and re-run `/validate`. Repeat until it passes.
- **Commit before review:** Once validation passes, commit the validated implementation snapshot before proceeding to Internal Review. Internal review and any later review-fix command must start from a clean working tree that reflects the current implementation state.

## 8. Internal Review

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

## 9. Internal Review Fix Loop

- If internal review finds issues, fix them before asking the human to test.
- After each review-driven code change, apply `AGENTS.md § Fix Loop Decision Rules`.
- For small incremental fixes the main agent may run `/code-review` inline since it just saw the subagent's findings and has context to verify targeted fixes. For larger fixes — or whenever the rules table says "respawned reviewer subagent" — spawn a fresh reviewer subagent with a new brief rather than reusing the main agent.
- Cap: 3 cycles. If the loop does not converge to clean after 3 fix-and-re-review cycles, emit the `▸ Halted Step 9/15 — Internal Review Fix Loop` banner naming the blocking findings, then fire a `Blocker Gate` (see `ai/workflow/gates.md § Blocker Gate`) — typically `retry one more cycle` / `accept partial state and continue to Manual Testing or PR Open` / `abort workflow`.
- Once the fix loop is clean, automatically commit the resulting review-driven changes. Verify `git status --short` is clean. If no review-driven changes were needed beyond the Validation Complete implementation snapshot commit, note that explicitly instead of creating an empty commit.
- **Exit:** Autonomous. For user-visible changes, continue into Manual Human Testing. For non-user-visible changes, skip Manual Testing and continue into PR Open.

## 10. Manual Human Testing

- **Prerequisite — clean working tree:** Before presenting the testing checklist, verify `git status --short` is empty. Any stray uncommitted changes (including whitespace-only diffs or unrelated `plan.md` edits from prior sessions) must be resolved first — either committed on this branch if they belong to the feature, stashed if they are unrelated, or reverted if they are accidental. The human should test the same state that will be reviewed and merged; untracked drift in the working tree invalidates that guarantee.
- **Not user-visible** (docs, harness, config, test-only): skipped per Internal Review Fix Loop's exit; continue autonomously to PR Open. The Manual Testing Outcome gate does not fire.
- **User-visible change:** Present the testing checklist. Include a concise summary of what changed and how it affects user experience or behavior. Explicitly state whether the human needs to restart Metro, rebuild the app, both, or neither.
- **Checklist:** Provide inline. For follow-up fixes, provide only incremental retest steps unless the full flow needs re-running.
- **Gate:** Once the checklist is presented and the human has had a chance to run it, fire the **Manual Testing Outcome** Confirmation Gate (see `ai/workflow/gates.md § Confirmation Gate`). Options: `proceed` (mark `[R]`, continue to PR Open) or `address issues` (enter Manual Testing Fix Loop).

## 11. Manual Testing Fix Loop

- **Entry:** Human selected `address issues` at the Manual Testing Outcome gate.
- **Fix loop:** Apply `AGENTS.md § Fix Loop Decision Rules`. Request targeted retesting only for the affected behavior.
- **Exit:** After the fix lands and the human re-tests, re-present the **Manual Testing Outcome** Confirmation Gate (same gate as Manual Human Testing). On `proceed`, mark the `plan.md` item `[R]` and continue autonomously to PR Open.

## 12. PR Open

- **Prerequisite:** Manual Human Testing or Manual Testing Fix Loop complete; the matching `plan.md` item is marked `[R]` when this branch maps to one.
- **Open:** Execute `/open-pr`. The command owns the `plan.md [x]` commit and push when a matching `plan.md` item exists.

## 13. PR Review Comments

- **Entry:** Event-driven, and strictly requires a real review artifact. This step does not auto-enter when PR Open completes. Valid entry signals — at least one must hold before the gate fires:
  1. At least one GitHub review comment, review, or thread is present on the PR (verifiable via `gh pr view --json reviewThreads,reviews` or `gh pr view --json comments`).
  2. A fresh external `## Review (...)` block has been appended to `ai/local/reviews/<branch-slug>.md` by an out-of-session `/code-review` run against the PR.
  3. The human explicitly confirms in chat that an external review cycle has already completed elsewhere (verbal confirmation of a completed review, not an intent to run one).
- Invoking `/address-code-review` or `/code-review` is **not** a valid entry signal on its own. Those commands are the actions taken **after** the gate fires on the Approve or Challenge path — they do not substitute for a real review artifact. Silence after `/open-pr` (no comments, no external review block, no explicit confirmation) holds the branch paused between Step 12 and Step 13; the agent must wait for one of the three signals above before firing the gate.
- **Gate:** On entry, fire the **PR Review Approval** Three-Way Approval Gate (see `ai/workflow/gates.md § Three-Way Approval Gate`). The human chooses:
  - **Approve** → run `/address-code-review` against the PR. `/address-code-review` consumes GitHub review threads, fixes each actionable finding (committing and pushing per its procedure), and cycles through PR Review Fix Loop as needed.
  - **Challenge externally** → pause for a fresh-context `/code-review` on the PR (any provider, new session). Returns here once the external block is appended.
  - **Revise manually** → pause for manual edits or natural-language change instructions, re-verify once, then return to the gate.
- **No actionable threads after `/address-code-review`:** If the human approved the gate *and* `/address-code-review` legitimately finds no unresolved GitHub threads (because reviewers posted questions-only, non-blocking suggestions, or the threads were already resolved on GitHub), the command reports "nothing to address" and flows to Merge Approval without entering PR Review Fix Loop. This shortcut is only available after the gate has actually fired and `/address-code-review` has actually run — it is never reached by auto-approving a freshly-opened PR with no comments.

## 14. PR Review Fix Loop

- **Entry:** Actionable review findings from PR Review Comments.
- **Fix loop:** Apply `AGENTS.md § Fix Loop Decision Rules`. Request targeted manual retesting when the fix changes user-visible behavior.
- **Cap:** Repeat up to 3 cycles. If the review queue is still not clean after 3, emit the `▸ Halted Step 14/15 — PR Review Fix Loop` banner and fire a `Blocker Gate` (see `ai/workflow/gates.md § Blocker Gate`) — typically `retry one more cycle` / `accept partial state and move to Merge Approval` / `abort workflow`.
- **Exit:** Review queue is clean and all replies are posted; continue autonomously to Merge Approval.

## 15. Merge And Cleanup

- **Gate:** Fire the **Merge Approval** Confirmation Gate (see `ai/workflow/gates.md § Confirmation Gate`) at the start of this step. The human confirms the PR is approved on GitHub and merging should proceed now.
- **Merge:** On approval, execute `/finish-feature`. The command merges via GitHub CLI, safety-checks the workspace, removes the branch or worktree, and returns to `main`.
