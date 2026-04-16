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
    description: 'Merge recommendation reported in chat: approve, request changes, or comment'
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

1. Load the review checklist from `ai/skills/quality-review/SKILL.md` § Review Checklist.
2. Cross-reference `plan.md` to confirm the changes align with the intended task scope.

### Step 3: Review Each Changed File

For every file in the diff, apply the checklist loaded in Step 2. Flag each finding with `file:line` references and severity:

- **bug** — incorrect behaviour or crash risk
- **regression** — breaks existing functionality
- **convention** — violates project standards
- **suggestion** — improvement that is not blocking

### Step 4: Write Findings

Write the full review output to `ai/local/reviews/<branch-slug>.md` for **every** run, regardless of source. The review file is the canonical work queue: follow-up agents (internal fix loop, `/address-code-review`, cross-provider handoff) consume it directly. Overwrite or append to the same file on repeat runs.

Use this structure:

```md
# Review: <branch-name>

Date: <YYYY-MM-DD>
Source: <local | gh>
Recommendation: <approve | request changes | comment>

## Findings

- [ ] `<file-path>:<line>` [<severity>] - <Description of the issue and recommended fix>
- [ ] ...

## Summary

<2-3 sentences: overall quality assessment and what needs attention>
```

### Step 5: Report In Chat

Post a summary in chat:

```md
**Review Complete** (<source>)
Recommendation: <approve | request changes | comment>

- 🐛 Bugs: <count>
- ⚠️ Regressions: <count>
- 📏 Conventions: <count>
- 💡 Suggestions: <count>

Details: ai/local/reviews/<branch-slug>.md
```

When running in **specialist reviewer** mode, stop after this summary and artifact path. Do not suggest the next workflow step and do not ask `Proceed to Step <N>?`.

When running in **workflow owner** mode, the surrounding workflow step may add the usual handoff after this review result.

## Completion Criteria

- Every changed file has been reviewed against the checklist and conventions.
- Findings are written to `ai/local/reviews/<branch-slug>.md` with `file:line` references.
- A merge recommendation is posted in chat.

## See Also

- `ai/skills/quality-review/SKILL.md` — review checklist and quality standards
- `ai/commands/address-code-review/COMMAND.md` — consume findings and fix them
