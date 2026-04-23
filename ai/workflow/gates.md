# Gate Mechanics

This file is a chunked continuation of `AGENTS.md`. The spine owns the anchor; do not add new workflow policy here without adding its trigger to the spine.

Anchor in spine: `AGENTS.md § Phases` lists the two human-gated boundaries — **Plan Approval** (end of Plan phase) and **Manual Testing Outcome** (end of Manual Test phase for user-visible changes). Load this file before firing any gate.

## Three-Way Approval Gate

Used only at **Plan Approval**. Present three options. **Only `approve` advances the workflow.** `challenge` and `revise` keep the agent paused at the same gate — after each runs its course, the gate is re-presented.

| Option | Accept text | Agent behavior | Does it advance? |
|---|---|---|---|
| **Approve** | `1`, `approve`, `proceed`, `ok`, `go` | Lift the Plan phase plan-mode read-only constraint and transition to Implement. | Yes |
| **Challenge externally** | `2`, `challenge`, `external` | Pause. Instruct the human to run `/review-plan` from a fresh context on any provider — a new session on the same provider or any other provider both qualify; the requirement is fresh context, not provider diversity. The fresh-context run appends a new `## Review (<provider>, <ISO>)` block per `ai/workflow/review-file.md`. On human return signal (`done` or similar), route per **Challenge-return routing** below, then re-present the gate. | No — returns to gate |
| **Revise manually** | `3`, `revise`, `edit`, `change` | Pause. Accept manual edits to the plan or natural-language change instructions (apply them directly). After changes land, re-run `/review-plan` inline once to re-verify, then return to the gate. | No — returns to gate |

**Challenge-return routing.** On the human's return signal, the main agent inspects the latest appended block in the review file:

- Latest block is `ready`, no unchecked findings → skip the address pass, announce "external review clean", re-present the gate.
- Latest block has unresolved findings or `Recommendation: revise` → run `/address-plan-review` in the same session, announce the updated state, re-present the gate. **Do not re-run the internal review loop.** The fresh-context block covered the artifact; addressing it is sufficient verification.

**Why Challenge and Revise differ on re-review.** Revise leaves the artifact unreviewed, so it re-enters the review path once; Challenge ends with a fresh-context review block, so it doesn't.

**Primitive.** Use the host's interactive primitive (e.g., `AskUserQuestion`) — mandatory when available. Fall back to a numbered list in chat only when no interactive primitive exists. All options must be presented alongside the universal `Rewind` / `Abort` escapes (see § `Rewind`).

## Confirmation Gate

Used only at **Manual Testing Outcome** for user-visible changes.

| Gate | Options | Advance behavior | Other-option behavior |
|---|---|---|---|
| **Manual Testing Outcome** | `proceed` \| `address issues` | Mark `plan.md` item `[R]`; flow to PR. | Enter the Manual Test fix loop; fix the reported issues; re-present this gate after the human re-tests. |

**Primitive.** Same mandate as § `Three-Way Approval Gate` — host's interactive primitive when available, numbered-list fallback otherwise. Universal `Rewind` / `Abort` escapes must be offered alongside the two primary options.

## Blocker Gate

Used whenever the agent cannot proceed and needs the human to unblock — non-converging fix loops, unresolved product/business questions during Plan, prerequisite failures (dirty `main`, missing plan file, auth failures), or any other halt state. Converts every "stop and report" into a structured choice.

Options adapt to the blocker. Typical patterns:

| Blocker type | Typical options |
|---|---|
| Non-converging fix loop (Review, Manual Test, or PR) | `retry one more cycle` \| `accept partial state` \| `rewind to <phase>` \| `abort workflow` |
| Unresolved product/business question during Plan | 2–4 concrete mutually-exclusive answers to the specific question, plus `Other` / free-text escape |
| Prerequisite failure (e.g., dirty `main` during Bootstrap) | `fix and retry` \| `abort workflow` |
| Missing dependency (e.g., plan file absent when `/address-plan-review` runs) | `create the missing file` \| `point me at an alternate path` \| `abort` |

**Banner pairing.** The `▸ Halted <Phase> — <condition>` banner names the blocking condition in its subtitle; the Blocker Gate fires immediately after the banner with options tailored to that condition.

**Primitive.** Same mandate as above. Always include `abort` / `cancel` / `other` so the human is never cornered.

## Rewind

Every gate accepts a universal `rewind to <phase>` escape alongside its primary options. Use it when:

- The current phase produced something that needs undoing (e.g., manual testing revealed the wrong feature was built → rewind to Plan or Implement).
- A scope change emerged and rolling forward doesn't make sense.

Rewinding does not discard work — commits stay, artifacts stay. It just re-enters an earlier phase so the agent can draft a correction path from there. For scope changes specifically, prefer invoking `/amend-plan` (which records the reason) over a bare `rewind`.

`Abort workflow` is always available too — it stops the agent without making further changes. The human decides what to do with the uncommitted or partially-done work manually.
