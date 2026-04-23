---
name: amend-plan
description: >-
  Record a mid-flight scope change in the active branch's plan. Edits the
  canonical plan file, appends a dated scope-change entry, and routes back
  to the appropriate phase (Implement for minor changes, Plan for major).
inputs:
  - name: reason
    description: 'Short explanation of what changed and why. Prompted if omitted.'
    default: (prompted)
  - name: severity
    description: '"minor" (continue to Implement) or "major" (return to Plan with re-approval). Inferred from scope of change if omitted.'
    default: (inferred)
outputs:
  - name: plan-file
    description: 'Updated canonical plan at ai/local/plans/<branch-slug>.md with a new ## Scope Changes entry.'
  - name: next-phase
    description: '"Implement" or "Plan" depending on severity.'
---

# Amend Plan

Record a mid-flight scope change in the active branch's plan. Invoked when, during Implement, Review, Manual Test, or PR, the agent or human realizes the plan was incomplete, wrong, or needs to cover newly-discovered work.

This is the canonical rewind mechanism for scope changes — prefer it over gate-level `rewind` when the issue is that the plan was wrong.

## Prerequisites

- Current branch is a feature branch, not `main`.
- The canonical plan file exists at `ai/local/plans/<branch-slug>.md`.
- The workflow is past Plan Approval (otherwise just edit the plan directly inside the Plan phase).

## Procedure

### Step 1: Verify Branch And Plan File

```bash
git branch --show-current
```

- If the current branch is `main`, stop and report a blocker.
- Confirm the plan file exists: `test -f ai/local/plans/<branch-slug>.md`. If missing, stop and report a blocker. Do not fabricate a plan retroactively.

### Step 2: Capture The Reason

If a `reason` was provided as input, use it verbatim. Otherwise ask the human directly — a one or two sentence explanation is sufficient. Examples:

- `"Testing revealed the auth middleware needs a refresh-token path; original plan only covered access tokens."`
- `"PR reviewer flagged that the new route must be gated behind the existing feature flag."`
- `"Mid-implementation discovery: the BLE peripheral returns a different characteristic UUID on iOS 17."`

Reasons should be specific enough that a future reader (or you, six weeks from now) can reconstruct why the plan deviated. Vague reasons ("scope creep" / "needed more") are not sufficient — push back and ask for specifics.

### Step 3: Classify Severity

Classify as `minor` or `major` — this determines the next phase:

| Severity | Criteria | Next phase |
|---|---|---|
| `minor` | Adds a clarification, a small new sub-task, or tightens an existing decision. Does not require re-approval. | `Implement` |
| `major` | Changes architecture, adds a new subsystem, invalidates earlier review findings, or significantly expands scope. Requires re-approval. | `Plan` |

If the change would have triggered a Plan review subagent had it been in the original plan (native layer, DB migration, routing, shared contracts — see `AGENTS.md § Plan Review Subagent Threshold`), classify as `major`.

When uncertain, default to `major` — the cost of a short re-approval cycle is low; the cost of silently drifting past a re-approval that was actually warranted is high.

### Step 4: Update The Plan File

Edit `ai/local/plans/<branch-slug>.md`:

1. **Fold the change into the plan body** naturally. Update the relevant section, add a new sub-task, or clarify an existing decision — whatever makes the plan accurate going forward. Keep the plan as a clean implementation blueprint, not a diff log.
2. **Append (or update) a `## Scope Changes` section** near the end of the plan, just before `## What Will Be Available After Completion`. Add an entry in this format:

```md
## Scope Changes

- **<ISO date> — <severity> — <phase at time of change>**
  <reason, 1-3 sentences>
  Updated: <short summary of what sections/tasks were modified>
```

If the `## Scope Changes` section already exists, append the new entry at the bottom of the existing list — do not rewrite prior entries.

3. Keep `## What Will Be Available After Completion` as the absolute final section.

### Step 5: Route To Next Phase

Per the severity classification:

- **`minor`:** Announce the update briefly (`**Plan Updated**` header, reason, affected sections). Return control to the phase the workflow was in when `/amend-plan` was invoked — typically Implement or Review. No gate fires.
- **`major`:** Announce the update. Re-enter the Plan phase at the Plan Approval gate. If the change would have required a reviewer subagent originally, run `/review-plan` (fresh-context subagent when available, inline otherwise) against the updated plan before firing the gate. The gate re-fires with the updated plan as the approval target.

### Step 6: Report

```md
**Plan Amended**
- Branch: `<branch-name>`
- Severity: <minor | major>
- Reason: <one-line quote of the reason>
- Plan section(s) updated: <comma-separated>
- Next phase: <Implement | Plan>
```

If severity is `major`, the report is followed immediately by the Plan Approval gate banner.

## Completion Criteria

- Plan file has a fresh `## Scope Changes` entry at the bottom listing date, severity, phase, and reason.
- Plan body reflects the scope change in the relevant sections.
- Next-phase routing was announced and executed.

## See Also

- `ai/commands/review-plan/COMMAND.md` — used on `major` amendments when the updated plan needs a fresh review
- `ai/workflow/gates.md § Rewind` — gate-level rewind (prefer `/amend-plan` when the issue is plan correctness, not phase output)
