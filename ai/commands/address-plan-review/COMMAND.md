---
name: address-plan-review
description: >-
  Triage the active branch's plan-review findings, update the canonical plan
  intentionally, and record what was applied or declined.
inputs: []
outputs:
  - name: plan-file
    description: 'Updated canonical plan at ai/local/plans/<branch-slug>.md'
  - name: review-file
    description: 'Updated plan review log at ai/local/plans/<branch-slug>.review.md'
  - name: recommendation
    description: '"ready", "revise", or "blocked" after resolving the review queue'
---

# Address Plan Review

Consume the active branch's plan-review findings, decide which items are worth applying, decline weak or incorrect suggestions with explicit reasons, and update the canonical plan without turning it into a review scrapbook. This command is the resolution pass inside the Plan phase in `AGENTS.md § Phases`.

## Prerequisites

- Current branch is a feature branch, not `main`.
- The feature workflow is inside the Plan phase (see `AGENTS.md § Phases`) — i.e., the plan has not yet been approved for implementation.
- The canonical plan file exists at `ai/local/plans/<branch-slug>.md`.
- The canonical review file exists at `ai/local/plans/<branch-slug>.review.md`.
- The working tree is clean apart from the current branch's plan and plan-review artifacts. If unrelated tracked files are dirty, stop and report the blocker.

## Procedure

### Step 1: Verify Branch, Planning Context, And Allowed Dirty State

```bash
git branch --show-current
git status --short
```

- If the current branch is `main`, stop and report a blocker.
- Set:
  - `plan-file` = `ai/local/plans/<branch-slug>.md`
  - `review-file` = `ai/local/plans/<branch-slug>.review.md`
- If the canonical plan file or review file is missing, stop and report a blocker.
- If tracked changes exist outside the current branch's plan/review artifacts, stop and report a blocker rather than mixing plan-review resolution with unrelated work.

### Step 2: Load Context

Read these sources before making any edits:

1. `ai/local/plans/<branch-slug>.md`
2. `ai/local/plans/<branch-slug>.review.md`
3. `plan.md`
4. `AGENTS.md`

Treat `plan.md` and `AGENTS.md` as the source of truth for scope, workflow correctness, and plan-file conventions.

### Step 3: Extract Review Items And Triage Them

Read actionable items from the review file in this order:

1. `## Must Change`
2. `## Missing Decisions`
3. `## Suggested Improvements`

Classify each item into exactly one outcome:

| Outcome | Use when | Action |
|---|---|---|
| `apply` | The review item is valid, aligned with repo rules, and should improve the plan now | Update the plan |
| `decline` | The suggestion is weak, incorrect, out of scope, already covered elsewhere, or would introduce unsupported assumptions | Do not edit the plan; record a concrete reason |
| `already-resolved` | The current plan already addresses the point | Do not edit the plan; record where it is already handled |
| `needs-user-input` | The item depends on a true product or workflow choice that cannot be derived from repo context | Do not invent the answer; record the exact question |

Evaluation criteria — apply the same plan quality standards as `/review-plan` Step 4. Accept only changes that improve alignment with `plan.md` or `AGENTS.md`; reject changes that introduce scope creep or swap one unsupported assumption for another.

When the only review issue is missing `plan.md` linkage:
- if the work clearly matches an existing `plan.md` item, update the plan to point to that item
- otherwise, the item may be resolved by recording explicit branch-local scope when that matches human intent and `AGENTS.md`

Never apply a suggestion just because it appears in the review file.

### Step 4: Update The Canonical Plan For Accepted Items

For every `apply` item:

1. Edit `ai/local/plans/<branch-slug>.md` directly.
2. Fold the change naturally into the existing plan structure rather than appending a review-response section.
3. Preserve the plan as a clean implementation blueprint.
4. Keep `## What Will Be Available After Completion` as the final section.
5. If repo-discoverable facts are needed to resolve the item, derive them and update the plan accordingly.
6. If the item turns out to require a real user decision, reclassify it as `needs-user-input` instead of guessing.

### Step 5: Update The Review File (In-Place)

Update findings in place per `ai/workflow/review-file.md § Review Resolution Format`. Use the following outcome verbs for plan-review findings:

| Outcome verb | Use when |
|---|---|
| `APPLIED: in <plan section>` | Review item was valid and folded into the plan |
| `DECLINED: <concrete reason>` | Suggestion was weak/incorrect/out of scope — rationale must name it (conflicts with `plan.md`, conflicts with `AGENTS.md`, already handled elsewhere, unnecessary complexity, or unsupported guessing) |
| `ALREADY RESOLVED: <plan section>` | Current plan already addresses the point |
| `NEEDS USER INPUT: <exact question>` | Depends on a real user decision — record the exact unresolved question, not a placeholder |

After checking off the processed items, append a brief resolution summary to the bottom of the file (or update the existing `## Resolution Summary` block if present). This trailing `## Resolution Summary` block is owned by `/address-plan-review` only (see `ai/workflow/review-file.md § Review Resolution Format`).

```md
## Resolution Summary

Recommendation: <ready | revise | blocked>

<1-3 sentences summarizing what was applied, what was intentionally declined, and whether the plan is now safe to implement.>
```

Missing `plan.md` linkage does not stay blocking once the plan explicitly records approved branch-local scope for work that does not match an existing `plan.md` item.

### Step 6: Re-Evaluate Readiness

After updating the plan:

- perform an inline final readiness pass using the same criteria as `/review-plan`
- do not assume the plan is automatically good just because some items were applied

Recommendation rules:

- `ready` — all blocking items are resolved or intentionally declined, and no unresolved decision gaps remain
- `revise` — review work still remains, but no new human decision is required yet
- `blocked` — one or more items still require explicit user input before the plan is decision-complete

### Step 7: Report In Chat

Post a compact summary in chat:

```md
**Plan Review Addressed**
Recommendation: <ready | revise | blocked>

- Applied: <count>
- Declined: <count>
- Already resolved: <count>
- Needs user input: <count>

Details:
- ai/local/plans/<branch-slug>.md
- ai/local/plans/<branch-slug>.review.md
```

If the command stopped early because of `main`, missing files, or unrelated dirty tracked files, report that blocker clearly and do not edit either file.

Close out per `AGENTS.md` § `Agent Roles` — workflow owner mode flows into the next step from the enclosing workflow stage; specialist reviewer mode stops here.

## Completion Criteria

- Branch is a feature branch.
- Planning context is intact (plan + plan-review file present).
- Working tree contains no unrelated dirty files.
- Every actionable review item was classified as `apply`, `decline`, `already-resolved`, or `needs-user-input`.
- Accepted items were folded into the canonical plan cleanly.
- A resolution block was appended to the review file.
- Final readiness was reassessed and reported as `ready`, `revise`, or `blocked`.

## See Also

- `ai/commands/review-plan/COMMAND.md` — generate or refresh plan-review findings
- `ai/commands/check-state/COMMAND.md` — bootstrap or resume branch context
