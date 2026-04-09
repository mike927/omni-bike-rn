---
name: open-pr
description: >-
  Open a GitHub PR with a standardized summary built from the branch diff and plan context.
inputs:
  - name: base
    description: 'Base branch for the PR'
    default: main
outputs:
  - name: pr-url
    description: 'URL of the newly opened PR'
---

# Open PR

Open a GitHub pull request with a standardized body.

## Prerequisites

- Current branch is **not** `main`.
- All intended commits are pushed to the remote.
- `gh` CLI is authenticated.
- Validation has been run (step 5) — ideally all checks pass.

## Procedure

### Step 1: Verify Environment And Branch State

```bash
gh auth status
git branch --show-current
git status
git log --oneline main..HEAD
```

Confirm:
- `gh` is authenticated.
- Not on `main`.
- Working tree is clean (no uncommitted changes).
- There are commits to include in the PR.

Check if a PR already exists for this branch:

```bash
gh pr view --json number,url,state 2>/dev/null
```

If a PR already exists (any state), report its URL and stop — do not create a duplicate. If the existing PR is closed and a new one is intended, note this and ask the user to confirm before proceeding.

If the branch has not been pushed, push it:

```bash
git push -u origin <branch-name>
```

### Step 2: Merge Upstream

Ensure the feature branch is up to date with `main` before opening the PR:

```bash
git fetch origin
```

Check if a merge is actually needed:

```bash
git log HEAD..origin/main --oneline
```

- If the output is **empty**: branch is already up to date — skip the merge and proceed to Step 3.
- If commits are listed: merge them in:

```bash
git merge origin/main
```

- If the merge completes cleanly, push the merge commit: `git push`.
- If there are conflicts: abort the merge (`git merge --abort`), report the conflicting files to the user, and stop. Do not attempt automatic conflict resolution — ask the user to resolve and re-run the command.

### Step 3: Gather Context

1. **Diff summary**: `git diff main...HEAD --stat` for changed files, `git diff main...HEAD` for full diff.
2. **Commit log**: `git log --oneline main..HEAD` for commit messages.
3. **Plan context**: Read `plan.md` to identify which task item(s) this branch addresses.
3. **Validation state**: Run a quick validation or note if it is unknown.

### Step 4: Build PR Title

Use Conventional Commits style matching the primary change:

- `feat: <short description>` for new features
- `fix: <short description>` for bug fixes
- `docs: <short description>` for documentation changes
- `refactor: <short description>` for refactors

Keep the title under 70 characters.

### Step 5: Build PR Body

Use this template:

```md
## Summary

- <Bullet point describing what was added, changed, or fixed>
- <Bullet point explaining why this was changed or why a specific approach was chosen>
- <Add more bullet points as needed...>

## Plan Item

<Quote or reference the relevant plan.md task line>

## Testing Notes

<What the reviewer should test manually, if anything. Include whether a rebuild or Metro restart is needed.>
```

### Step 6: Create The PR

```bash
gh pr create --base <base> --head <branch-name> --title "<title>" --body "<body>"
```

Use a HEREDOC for the body to preserve formatting.

### Step 7: Record PR State

1. Report the PR URL in chat.
2. Update the relevant `plan.md` item to `[x]` (since opening the PR essentially completes the development phase for this branch) and commit separately:

```bash
git add plan.md
git commit -m "docs: mark <task> as completed in plan"
git push
```

## Completion Criteria

- PR is created on GitHub with a well-formatted body.
- PR URL is reported in chat.
- Workflow file and plan.md are updated.
