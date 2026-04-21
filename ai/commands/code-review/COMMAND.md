---
name: code-review
description: >-
  Run a code review against the branch diff (local working tree or GitHub PR)
  and persist findings to the local review file.
inputs:
  - name: source
    description: '"local" (default) reviews HEAD + working tree vs the target branch. "gh" reviews the open PR via `gh pr diff`.'
    default: local
outputs:
  - name: review-file
    description: 'Findings written to ai/local/reviews/<branch-slug>.md'
  - name: state
    description: 'Review state written to the review file: ready or needs-changes (needs-review is written only as an in-progress marker during the run)'
---

# Code Review

Run an internal code review and persist findings to the local review file.

## Prerequisites

- Current branch is a feature branch, not `main`.
- For `source: gh`: an open PR must exist for the current branch and `gh` CLI must be authenticated.
- Invocation mode follows `AGENTS.md` `## Agent Roles`: direct review requests use specialist reviewer mode; workflow-owned reviews use workflow owner mode.

## Procedure

### Step 1: Collect The Diff

Read the `source` input. Default is `local`.

| Source  | How to collect the diff                                                              |
|---------|--------------------------------------------------------------------------------------|
| `local` | `git diff <target-branch>...HEAD` plus any staged and unstaged working-tree changes  |
| `gh`    | `gh pr diff` + `gh pr view --json number,title,body,url,baseRefName,headRefName`     |

`<target-branch>` is the merge-base branch (usually `main`).

For `gh` source, also fetch CI status: `gh pr checks`.

### Step 2: Load Review Context

1. Load the review checklist from `ai/skills/quality-review/SKILL.md` § `Review Checklist`.
2. Cross-reference `plan.md` to confirm the changes align with the intended task scope.

### Step 3: Review Each Changed File

For every file in the diff, apply the checklist loaded in Step 2. Flag each finding with `file:line` references and severity:

- **bug** — incorrect behaviour or crash risk
- **regression** — breaks existing functionality
- **convention** — violates project standards
- **suggestion** — improvement that is not blocking

### Step 4: Append A New Review Block

Append a fresh `## Review (<provider>, <ISO timestamp>)` block to the end of `ai/local/reviews/<branch-slug>.md` on every run, regardless of source. Every invocation appends; nothing in the file is overwritten. The review file is the canonical work queue — follow-up agents (internal fix loop, `/address-code-review`, cross-provider handoff) consume every block.

Values:
- `<provider>` — the host name (e.g., `Claude`, `Codex`, `Gemini`).
- `<ISO timestamp>` — UTC ISO-8601, second precision (e.g., `2026-04-21T14:15:00Z`).

Block structure:

```md
## Review (<provider>, <ISO timestamp>)

State: <ready | needs-changes>
Source: <local | gh>

### Findings

- [ ] `<file-path>:<line>` [<severity>] - <Description of the issue and recommended fix>
- [ ] ...

### Summary

<2-3 sentences: overall quality assessment and what needs attention>
```

File-level rules:

- If no prior file exists, create it with a single `# Review: <branch-name>` H1 on line 1, then append the first block below it.
- If the file exists, append the new `## Review (...)` block at the absolute end of the file (after every prior block).
- File-level `State` is read from the **latest** `## Review (...)` block — this is how `AGENTS.md` § `Review File State` and `/open-pr` determine readiness.
- Never delete, edit, or reorder prior blocks.

Block-content rules:

- If the run may be interrupted (long review, flaky tooling, cross-provider handoff mid-flight), append the block header first with `State: needs-review`, then overwrite just that line when final findings are ready. In a single-pass run, write the final `State:` value directly — the `needs-review` waypoint is a resilience measure, not a requirement.
- Set the final `State` per `AGENTS.md` § `Review File State`: `ready` when no unresolved actionable findings of severity bug, regression, or convention remain (suggestions-only or empty counts as ready), otherwise `needs-changes`.
- `/code-review` is the only writer that sets `State: ready`; `/address-code-review` closes out at `needs-review`, never `ready`.

### Step 5: Report In Chat

Post a summary in chat:

```md
**Review Complete** (<source>)
State: <ready | needs-changes>

- 🐛 Bugs: <count>
- ⚠️ Regressions: <count>
- 📏 Conventions: <count>
- 💡 Suggestions: <count>

Details: ai/local/reviews/<branch-slug>.md
```

Close out per the invocation mode rules in `AGENTS.md` § `Agent Roles`: specialist reviewer stops here; workflow owner may add the surrounding step's handoff.

## Completion Criteria

- Every changed file has been reviewed against the checklist and conventions.
- Findings are written to `ai/local/reviews/<branch-slug>.md` with `file:line` references.
- Review state is set and posted in chat following `AGENTS.md` § `Review File State`.

## See Also

- `ai/skills/quality-review/SKILL.md` — review checklist and quality standards
- `ai/commands/address-code-review/COMMAND.md` — consume findings and fix them
