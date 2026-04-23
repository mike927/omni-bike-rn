# Review File Contract

This file is a chunked continuation of `AGENTS.md`. The spine owns the anchor; do not add new workflow policy here without adding its trigger to the spine.

Anchor in spine: `AGENTS.md § Commands` (review-family append pointer) and `AGENTS.md § Workflow Artifacts` (canonical paths).

## Format

Both `/code-review` and `/review-plan` append a new `## Review (<provider>, <ISO timestamp>)` block to the end of the review file. Prior blocks and resolution sections stay intact — never overwrite.

- First run on a file: write an H1 header `# Review: <branch-name>` on line 1, then append the first block below it.
- Subsequent runs: append at the absolute end, after all prior blocks and any `/address-*` resolution sections.
- File-level state resolves against the **latest** `## Review (...)` block. Readers must locate the last one, not grep for the first match.

Append-mode exists because the Plan Approval gate's `Challenge externally` path spawns a fresh-context review that needs to record its verdict without clobbering the original. Everywhere else, one review block per run is enough.

## Latest Block Header

Each block starts with:

```
Recommendation: <ready | revise>
```

That is the entire state machine:

- `ready` — no blocking findings. `/open-pr` proceeds when the latest block is `ready`.
- `revise` — one or more blocking findings listed below. `/open-pr` stops and reports.

If the review file does not exist, `/open-pr` proceeds — missing file means no review was run (allowed for trivial changes).

## Resolution Format

Address-family commands (`/address-plan-review`, `/address-code-review`) update findings **in place** in the latest block, never moving them between sections.

- Change the checklist marker from `[ ]` to `[x]`.
- Append `-> <OUTCOME>: <detail>` inline on the same line.
- Do not relocate items or restructure headers.
- Outcome verbs are command-specific (see each command's outcome-verb table).

After an address-family command runs, it updates or appends a trailing `## Resolution Summary` section with the current `Recommendation:`. When all blocking findings are resolved, the summary's `Recommendation:` is `ready` and that becomes the authoritative state for downstream commands.
