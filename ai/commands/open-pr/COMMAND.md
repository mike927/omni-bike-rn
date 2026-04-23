---
name: open-pr
description: >-
  Open a GitHub PR with a standardized summary built from the branch diff and task context.
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
- Validation has been run — ideally all checks pass.

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

Check the internal review state. Read `ai/local/reviews/<branch-slug>.md` (if it exists) per `ai/workflow/review-file.md § Latest Block Header`:
- Latest `Recommendation: ready` (either on the latest `## Review (...)` block or on a trailing `## Resolution Summary`) — proceed.
- Latest `Recommendation: revise` — stop. Report and suggest `/address-code-review` (to resolve findings) or `/code-review` (to re-verify after fixes).
- File missing — proceed (no review was run; allowed for trivial changes).

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
3. **Task context**: Read `plan.md` to identify which task item(s) this branch addresses when a match exists. Otherwise record that this is branch-local work not tracked in `plan.md`.
4. **Validation state**: Run a quick validation or note if it is unknown.

### Step 4: Build PR Title

Derive the Conventional Commits prefix per `AGENTS.md` § `Commit Rules`, then a short description of the primary change. Keep the title under 70 characters.

### Step 5: Build PR Body

Use this template:

```md
## Summary

- <Bullet point describing what was added, changed, or fixed>
- <Bullet point explaining why this was changed or why a specific approach was chosen>
- <Add more bullet points as needed...>

## Scope

<Quote or reference the relevant plan.md task line, or state "Branch-local work not tracked in plan.md">

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
2. If the branch maps to a `plan.md` item, mark it `[x]` and commit the `plan.md` change per `AGENTS.md` § `Commit Rules`, then push. Otherwise note that no `plan.md` update is required and skip this sub-step.

## Completion Criteria

- PR is created on GitHub with a well-formatted body.
- PR URL is reported in chat.
- The `plan.md [x]` commit and push are completed when applicable.

## See Also

- `ai/commands/code-review/COMMAND.md` — verify the review file is clean before opening the PR
- `ai/commands/address-code-review/COMMAND.md` — work through incoming PR review comments
- `ai/commands/finish-feature/COMMAND.md` — merge and clean up after the PR is approved
