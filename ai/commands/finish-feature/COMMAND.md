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

Close out a completed feature: ensure `plan.md` is marked `[x]` when applicable, merge the PR using a 3-way merge commit, safety-check the local workspace, remove the branch or worktree, and return to `main`.

## Prerequisites

- The Merge phase (see `ai/workflow/steps.md § 7. Merge`) has been reached: PR is approved on GitHub and CI is green.
- Current branch is the feature branch (not `main`).
- `gh` CLI is authenticated (`gh auth status`).

## Procedure

### Step 1: Ensure Plan Is Marked Complete

Read `plan.md` and find the task item(s) for this branch.

- If the branch is intentional branch-local work with no matching `plan.md` item: note that no `plan.md` update is required and skip this sub-step.
- If already marked `[x]`: note the existing state and skip this sub-step.
- If not yet `[x]`: update the task to `[x]`, then commit and push as a `docs:` commit following `AGENTS.md` § `Commit Rules`.

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
- All commits from this branch are in `origin/main` — `git log origin/main..HEAD` must output nothing.
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

### Step 8: Clean Up Branch-Scoped Artifacts

Remove any of the three branch-scoped artifacts that exist on disk. Missing files are not errors — an unplanned bug fix may have skipped the plan-review cycle, a trivial change may have had no review findings, etc. The files are git-ignored, so deletion leaves no tracked-file residue.

```bash
rm -f ai/local/plans/<branch-slug>.md \
      ai/local/plans/<branch-slug>.review.md \
      ai/local/reviews/<branch-slug>.md
```

Record which paths actually existed before deletion so Step 9 can list them. If none existed, record `none`.

### Step 9: Report Completion

```
**Feature Complete**
- Plan: marked [x] (commit `<hash>` | already done | not applicable for branch-local work)
- PR: merged at `<pr-url>` (merge commit `<short-oid>`)
- Branch `<branch-name>`: removed
- Worktree: removed | N/A (in-place)
- Artifacts removed: <comma-separated list of deleted paths | none>
- Active branch: `main`
```

## Completion Criteria

- `plan.md` has the task marked `[x]` and that commit is merged into `main` — or the branch was explicitly branch-local work with no matching `plan.md` item.
- PR state is `MERGED` on GitHub.
- No unpushed local-only commits remain on the feature branch.
- Local branch is removed.
- Worktree is removed, if applicable.
- Branch-scoped artifacts in `ai/local/` are removed (plan, plan review, code review — whichever existed).
- Active branch is `main`.

## See Also

- `ai/commands/open-pr/COMMAND.md` — opens the PR (run before this command)
