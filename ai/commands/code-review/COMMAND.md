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
  - name: recommendation
    description: 'Review recommendation written to the review file: ready or revise'
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

Recommendation: <ready | revise>
Source: <local | gh>

### Findings

- [ ] `<file-path>:<line>` [<severity>] - <Description of the issue and recommended fix>
- [ ] ...

### Summary

<2-3 sentences: overall quality assessment and what needs attention>
```

File-level rules follow `ai/workflow/review-file.md § Format` (append-mode contract, latest-block-wins, never overwrite). If no prior file exists, create it with a single `# Review: <branch-name>` H1 on line 1, then append the first block below it.

Block-content rules:

- Set the final `Recommendation` per `ai/workflow/review-file.md § Latest Block Header`: `ready` when no unresolved actionable findings of severity bug, regression, or convention remain (suggestions-only or empty counts as ready), otherwise `revise`.

### Step 5: Report In Chat

Post a summary in chat:

```md
**Review Complete** (<source>)
Recommendation: <ready | revise>

- Bugs: <count>
- Regressions: <count>
- Conventions: <count>
- Suggestions: <count>

Details: ai/local/reviews/<branch-slug>.md
```

Close out per `AGENTS.md` § `Agent Roles` — workflow owner mode flows into the next phase from the enclosing workflow stage; specialist reviewer mode stops here.

## Completion Criteria

- Every changed file has been reviewed against the checklist and conventions.
- Findings are written to `ai/local/reviews/<branch-slug>.md` with `file:line` references.
- Review recommendation is set and posted in chat following `ai/workflow/review-file.md § Latest Block Header`.

## See Also

- `ai/skills/quality-review/SKILL.md` — review checklist and quality standards
- `ai/commands/address-code-review/COMMAND.md` — consume findings and fix them
