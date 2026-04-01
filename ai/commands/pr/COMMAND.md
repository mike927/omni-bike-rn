---
name: pr
description: >-
  Open a GitHub PR with a standardized summary built from the branch diff and plan context.
triggers:
  - 'open a PR'
  - 'create a pull request'
  - 'submit PR'
inputs:
  - name: base
    description: 'Base branch for the PR'
    default: main
outputs:
  - name: pr-url
    description: 'URL of the created PR, reported in chat'
  - name: workflow-update
    description: 'PR URL and status recorded in ai/local/workflows/<branch-slug>.md'
workflow-steps:
  - 10
---

# PR

Open a GitHub pull request with a standardized body. Maps to AGENTS.md workflow step 10 (PR Open).

## Prerequisites

- Current branch is **not** `main`.
- All intended commits are pushed to the remote.
- `gh` CLI is authenticated.
- Validation has been run (step 5) — ideally all checks pass.

## Procedure

### Step 1: Verify Branch State

```bash
git branch --show-current
git status
git log --oneline main..HEAD
```

Confirm:
- Not on `main`.
- Working tree is clean (no uncommitted changes).
- There are commits to include in the PR.

If the branch has not been pushed, push it:

```bash
git push -u origin <branch-name>
```

### Step 2: Gather Context

1. **Diff summary**: `git diff main...HEAD --stat` for changed files, `git diff main...HEAD` for full diff.
2. **Commit log**: `git log --oneline main..HEAD` for commit messages.
3. **Plan context**: Read `plan.md` to identify which task item(s) this branch addresses.
4. **Validation state**: If `ai/local/workflows/<branch-slug>.md` exists, read its Validation State section. Otherwise note that validation state is unknown.

### Step 3: Build PR Title

Use Conventional Commits style matching the primary change:

- `feat: <short description>` for new features
- `fix: <short description>` for bug fixes
- `docs: <short description>` for documentation changes
- `refactor: <short description>` for refactors

Keep the title under 70 characters.

### Step 4: Build PR Body

Use this template:

```md
## Summary

<2-4 bullet points describing what changed and why>

## Plan Item

<Quote or reference the relevant plan.md task line>

## Validation

<Per-command pass/fail from the most recent validation run, or "not yet run">

## Testing Notes

<What the reviewer should test manually, if anything. Include whether a rebuild or Metro restart is needed.>
```

### Step 5: Create The PR

```bash
gh pr create --base <base> --head <branch-name> --title "<title>" --body "<body>"
```

Use a HEREDOC for the body to preserve formatting.

### Step 6: Record PR State

1. Report the PR URL in chat.
2. If `ai/local/workflows/<branch-slug>.md` exists, update its **PR And Review State** section with the PR URL and status.
3. Update the relevant `plan.md` item to `[R]` and commit separately:

```bash
git add plan.md
git commit -m "docs: mark <task> as in review"
git push
```

## Completion Criteria

- PR is created on GitHub with a well-formatted body.
- PR URL is reported in chat.
- Workflow file and plan.md are updated.

## See Also

- `AGENTS.md` § Feature Workflow step 10 — PR Open rules