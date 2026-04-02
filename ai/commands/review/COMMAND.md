---
name: review
description: >-
  Run an internal code review against the current branch diff before opening a PR.
inputs:
  - name: scope
    description: 'What to review: "staged" (staged changes), "branch" (diff vs base), or "pr" (fetched PR diff)'
    default: branch
outputs:
  - name: review-file
    description: 'Review findings written to ai/local/reviews/<branch-slug>.md'
  - name: recommendation
    description: 'Merge recommendation reported in chat: approve, request changes, or comment'
---

# Review

Run an internal code review and report findings.

## Prerequisites

- Working directory is inside a project worktree (not the repo root on `main`).
- For `pr` scope: a PR must exist for the current branch and `gh` CLI must be authenticated.

## Procedure

### Step 1: Determine Scope And Collect Diff

Read the `scope` input. Default is `branch`.

| Scope    | How to collect the diff                                              |
|----------|----------------------------------------------------------------------|
| `staged` | `git diff --cached`                                                  |
| `branch` | `git diff main...HEAD`                                               |
| `pr`     | `gh pr diff` + `gh pr view --json number,title,body,url,baseRefName,headRefName` |

For `pr` scope, also fetch CI status: `gh pr checks`.

### Step 2: Load Review Context

1. Load the review checklist from `ai/skills/quality-review/SKILL.md` § Review Checklist.
2. Read the active workspace coding and workflow guidance for cross-cutting standards.
3. Cross-reference `plan.md` to confirm the changes align with the intended task scope.

### Step 3: Review Each Changed File

For every file in the diff:

1. **Logic**: Does the change match the plan item? Any scope creep or missing behaviour?
2. **Edge cases**: Null, empty, disconnected state, error paths.
3. **Duplication**: Any unnecessary repetition of UI or data logic?
4. **Tests**: Are mocks reset in `beforeEach` with `jest.clearAllMocks()`? Do mock shapes match current return types?
5. **Conventions**: TypeScript strict mode compliance, adapter pattern usage, layer direction, tagged logging, `unknown` for caught errors.
6. **Architecture**: No upward imports (features → services → parsers). Types in dedicated files, not inline in implementation.

Flag each finding with `file:line` references and severity:

- **bug** — incorrect behaviour or crash risk
- **regression** — breaks existing functionality
- **convention** — violates project standards
- **suggestion** — improvement that is not blocking

### Step 4: Write Findings

If the scope is `staged`, simply output the findings in chat and skip writing a persistent file since staged changes iterate rapidly.

For `branch` or `pr` scopes, write the full review output to `ai/local/reviews/<branch-slug>.md`:

```md
# Review: <branch-name>

Date: <YYYY-MM-DD>
Scope: <staged | branch | pr>
Recommendation: <approve | request changes | comment>

## Findings

### <file-path>:<line>
**Severity**: <bug | regression | convention | suggestion>
<Description of the issue and recommended fix>

### ...

## Summary

<2-3 sentences: overall quality assessment and what needs attention>
```

### Step 5: Report In Chat

Post a summary in chat:

```md
**Review Complete** (<scope>)
Recommendation: <approve | request changes | comment>

- 🐛 Bugs: <count>
- ⚠️ Regressions: <count>
- 📏 Conventions: <count>
- 💡 Suggestions: <count>

Details: ai/local/reviews/<branch-slug>.md
```

### Step 6: Cleanup (When Resolved)

If all findings in the review file are either addressed in code or explicitly acknowledged and intentionally skipped, remove the review file so `ai/local/reviews/` only contains open review work.

## Completion Criteria

- Every changed file has been reviewed against the checklist and conventions.
- Findings are written to the review file with `file:line` references.
- A merge recommendation is posted in chat.

## See Also

- `ai/skills/quality-review/SKILL.md` — review checklist and quality standards
