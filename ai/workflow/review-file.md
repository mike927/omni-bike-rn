# Review File Contract

This file is a chunked continuation of `AGENTS.md`. The spine owns the anchor; do not add new workflow policy here without adding its trigger to the spine.

Anchor in spine: `AGENTS.md § Commands` (review-family append pointer) and `AGENTS.md § Workflow Artifacts` (canonical paths).

## Review File State

**Append-mode contract (single owner).** Every `/code-review` and `/review-plan` invocation appends a new `## Review (<provider>, <ISO timestamp>)` block to the review file. File-level rules:

- Never overwrite or edit prior blocks. Every run appends to the absolute end of the file, after all previous blocks and any `/address-*` resolution sections.
- The latest block wins. File-level state, recommendation, and readiness all resolve against the **last** `## Review (...)` block — readers must locate it, not grep for the first match.
- The review file has no file-level `State:` header. State lives on the `State:` line **inside** the latest block.
- Prior blocks, cross-provider findings, and `/address-*` resolution sections are preserved verbatim. This is what enables the challenge path at the two review-approval gates (see `ai/workflow/gates.md § Three-Way Approval Gate`) to accumulate reviews across providers without clobbering.

**State values (written inside the latest block):**

| State (latest block) | Meaning | Written by (inside that block) |
|---|---|---|
| `needs-review` | Review in progress, or fixes await re-review | `/code-review` at start of its block; `/address-code-review` when all findings are resolved |
| `needs-changes` | Latest review has unresolved actionable findings | `/code-review` |
| `ready` | Latest review is clean | `/code-review` only |

- `/code-review` is the only command that writes `State: ready` (in the block it just appended).
- `/address-code-review` writes `State: needs-review` after fixes and hands off — never `ready`.
- `/open-pr` requires `State: ready` when a review file exists — specifically, the `State:` line inside the **last** `## Review (...)` block in the file.

## Review Resolution Format

Address-family commands (`/address-plan-review`, `/address-code-review`) update findings **in place** in the review file, never moving them between sections.

- Change the checklist marker from `[ ]` to `[x]`.
- Append the resolution inline using `-> OUTCOME: <detail>`.
- Do not restructure headers or relocate items.
- Outcome verbs are command-specific (see each command's own outcome-verb table).
- `/address-plan-review` additionally appends a `## Resolution Summary` block at the end of the review file summarizing the pass. `/address-code-review` does not use this trailing block; its `State:` transition is recorded inside the latest `## Review (...)` block instead.
