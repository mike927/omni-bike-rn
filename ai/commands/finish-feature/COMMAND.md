---
name: finish-feature
description: >-
  Mark plan.md complete, merge the PR via GitHub CLI (merge commit), verify
  the local workspace is clean, remove the branch or worktree, and return to main.
inputs: []
outputs:
  - name: plan-commit
    description: 'Commit hash of the plan.md [x] update (if a new commit was needed).'
  - name: pr-url
    description: 'URL of the merged PR.'
  - name: cleanup-status
    description: 'Confirmation in chat that the branch/worktree was removed and main is active, or a blocker report.'
---

# Finish Feature

Close out a completed feature: ensure `plan.md` is marked `[x]`, merge the PR using a 3-way merge commit, safety-check the local workspace, remove the branch or worktree, and return to `main`.

## Prerequisites

- Current branch is the feature branch (not `main`).
- All implementation is complete, validated, reviewed, and pushed.
- A PR exists for this branch on GitHub.
- `gh` CLI is authenticated (`gh auth status`).

## Procedure

### Step 1: Ensure Plan Is Marked Complete

Read `plan.md` and find the task item(s) for this branch.

- If already marked `[x]`: note the existing state and skip this sub-step.
- If not yet `[x]`: update the task to `[x]`, then commit and push:

```bash
git add plan.md
git commit -m "docs: mark <task> as completed in plan"
git push
```

Report the commit hash (or note that plan.md was already `[x]`).

### Step 2: Verify PR Is Open And Ready

```bash
gh pr view --json number,url,state,mergeable,reviewDecision,statusCheckRollup
```

Confirm:
- `state` is `OPEN`
- `mergeable` is not `CONFLICTING`
- `reviewDecision` is `APPROVED` or no blocking reviews
- CI checks are passing (no `FAILURE` in `statusCheckRollup`)

If any condition fails, stop and report the exact blocker. Do not merge a PR with conflicts, failing checks, or outstanding change requests.

### Step 3: Merge Via GitHub CLI

Use a 3-way merge commit to preserve full commit history:

```bash
gh pr merge <number> --merge --delete-branch
```

The `--delete-branch` flag removes the remote branch automatically after merge.

### Step 4: Confirm Merge

```bash
gh pr view <number> --json state,mergeCommit --jq '{state, mergeCommit: .mergeCommit.oid}'
```

Verify `state` is `MERGED`. Record the merge commit OID. If the state is not `MERGED`, stop and report.

### Step 5: Safety Gate — Verify Local Workspace Is Clean And Merged

```bash
git fetch origin
git log origin/main..HEAD --oneline
git status
git stash list
```

Check:
- No unpushed commits that are not already on `origin/main` (the plan commit from Step 1 is now merged, so this list should be empty).
- No uncommitted changes.
- No stash entries that contain feature work.

If any check fails, stop and report the exact blocker. Do not delete anything until the workspace is verified clean.

### Step 6: Switch To Main

```bash
git checkout main
git pull origin main
```

Confirm the current branch is `main` and local `main` is up to date with the merge commit.

### Step 7: Remove Local Branch Or Worktree

**In-place branch:**

```bash
git branch -d <branch-name>
```

**Dedicated worktree:**

```bash
git worktree remove ../omni-bike-rn-worktrees/<branch-slug>
git branch -d <branch-name>
```

Use `-d` (safe delete) not `-D`. If the safe delete fails, investigate before forcing — it means git believes the branch has unmerged work.

### Step 8: Report Completion

```
**Feature Complete**
- Plan: marked [x] (commit `<hash>` | already done)
- PR: merged at `<pr-url>` (merge commit `<short-oid>`)
- Branch `<branch-name>`: removed
- Worktree: removed | N/A (in-place)
- Active branch: `main`
```

## Completion Criteria

- `plan.md` has the task marked `[x]` and that commit is merged into `main`.
- PR state is `MERGED` on GitHub.
- No unpushed local-only commits remain on the feature branch.
- Local branch and worktree (if applicable) are removed.
- Active branch is `main`.

## See Also

- `ai/commands/open-pr/COMMAND.md` — opens the PR (run before this command)
- `ai/commands/address-pr-comments/COMMAND.md` — handles PR review comment cycles before merging
