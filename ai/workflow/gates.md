# Gate Mechanics

This file is a chunked continuation of `AGENTS.md`. The spine owns the anchor; do not add new workflow policy here without adding its trigger to the spine.

Anchors in spine: `AGENTS.md § Workflow Pacing and Discipline` lists the 5 gate points in workflow order. Load this file before firing any gate.

## Three-Way Approval Gate

Used at the two review-approval points — **Plan Approval** and **PR Review Approval**. Present three options. **Only `approve` advances the workflow.** `challenge` and `revise` keep the agent paused at the same gate — after each runs its course, the gate is re-presented for another decision.

| Option | Accept text | Agent behavior | Does it advance? |
|---|---|---|---|
| **Approve** | `1`, `approve`, `proceed`, `ok`, `go` | Continue the workflow. **Plan Approval:** lift the Plan Drafting plan-mode read-only constraint and transition to Implementation In Progress. **PR Review Approval:** run `/address-code-review` to consume and fix GitHub PR comments, cycle through PR Review Fix Loop as needed, then transition to Merge Approval. | Yes |
| **Challenge externally** | `2`, `challenge`, `external` | Pause. Instruct the human to run `/review-plan` (plan gate) or `/code-review` (PR review gate) from a fresh context on any provider — a new session on the same provider or any other provider both qualify; the requirement is fresh context, not provider diversity. The fresh-context run appends a new `## Review (<provider>, <ISO>)` block per `AGENTS.md § Commands`. The external reviewer is reviewer-only — it never runs the fix loop. On human return signal (`done` or similar), route per **Challenge-return routing** below, then re-present the gate. | No — returns to gate |
| **Revise manually** | `3`, `revise`, `edit`, `change` | Pause. Accept either manual human edits to the plan/code or natural-language change instructions (apply them directly). After changes land, re-enter the prior review loop (Plan Reviewing for plan gate; PR Review Comments → PR Review Fix Loop for PR-review gate) once to re-verify — then return to the gate. | No — returns to gate |

**Challenge-return routing.** On the human's return signal, the main agent inspects the latest appended block in the review file:
- Latest block has unresolved actionable findings, or its `Recommendation`/`State` is not `ready` → run `/address-plan-review` or `/address-code-review` in the same session, announce the updated state, and re-present the gate. **Do not re-run the internal review loop.** The fresh-context block already covered the artifact; addressing it is sufficient verification, and re-reviewing internally would duplicate the work the user explicitly chose to delegate.
- Latest block is clean (`ready`, no unchecked findings) → skip the address pass, announce "external review clean", and re-present the gate. The human can approve immediately without a pointless empty address run.

**Why Challenge and Revise differ on re-review.** Revise leaves the artifact unreviewed, so it re-enters the review loop once; Challenge ends with a fresh-context review block, so it doesn't.

**Primitive.** Use the host's interactive primitive (e.g., `AskUserQuestion`) — mandatory when available. Fall back to a numbered list in chat only when no interactive primitive exists.

## Confirmation Gate

Used at the three non-review gates — **Scope Clarification**, **Manual Testing Outcome**, and **Merge Approval**. A simple two-option prompt; the alternative is not "reject" but "pause for input" or "route to a fix loop".

| Gate | Options | Advance behavior | Other-option behavior |
|---|---|---|---|
| **Scope Clarification** | `proceed` \| `clarify` | Enter Plan Drafting. | Human supplies additional scope or corrections; agent integrates the clarification, then re-presents the gate. |
| **Manual Testing Outcome** | `proceed` \| `address issues` | Mark `plan.md` item `[R]`; continue to PR Open. | Enter Manual Testing Fix Loop; fix the reported issues, then re-present the gate after the human re-tests. |
| **Merge Approval** | `merge` \| `hold` | Run `/finish-feature`. | Stay at gate; human directs when to merge. |

**Primitive.** Same mandate as § `Three-Way Approval Gate` — host's interactive primitive when available, numbered-list fallback otherwise.

## Blocker Gate

Used whenever the agent cannot proceed and needs the human to unblock — fix-loop caps, unresolved product/business questions during Plan Drafting, prerequisite failures (dirty `main`, missing plan file, auth failures), or any other halt state. The purpose is to convert every "stop and report" into a structured choice.

The options adapt to the blocker. Typical patterns:

| Blocker type | Typical options |
|---|---|
| Fix-loop cap reached (3 cycles exhausted) | `retry one more cycle` \| `accept partial state` \| `abort workflow` |
| Unresolved product/business question during Plan Drafting | 2–4 concrete, mutually-exclusive answers to the specific question |
| Prerequisite failure (e.g., dirty `main` during Bootstrapping) | `fix and retry` \| `abort workflow` |
| Missing dependency (e.g., plan file absent when `/address-plan-review` runs) | `create the missing file` \| `point me at an alternate path` \| `abort` |

**Banner pairing.** The `▸ Halted Step N/15 — <Name>` banner names the blocking condition in its subtitle; the Blocker Gate fires immediately after the banner with options tailored to that condition.

**Primitive.** Same mandate as § `Three-Way Approval Gate` — host's interactive primitive when available, numbered-list fallback otherwise. Always include an `abort` / `cancel` / `other` escape so the human is never cornered into choosing something that does not apply.
