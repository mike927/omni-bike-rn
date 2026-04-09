---
name: address-pr-comments
description: >-
  Fetch GitHub PR review threads, triage by severity, fix each actionable item
  using the Fix Loop Decision Rules, and prepare paste-ready reply text per thread.
inputs:
  - name: pr-number
    description: 'GitHub PR number to process. If omitted, inferred from the current branch.'
    default: (inferred from current branch)
outputs:
  - name: fix-commits
    description: 'One or more commits pushed to the feature branch addressing actionable review comments.'
  - name: reply-notes
    description: 'Per-thread reply text printed in chat under a **PR Reply Notes** header.'
  - name: review-file
    description: 'ai/local/reviews/<branch-slug>.md updated with PR review findings and declined-item reasons.'
---

# Address PR Comments

Fetch GitHub PR review threads, triage them, fix each actionable item following the Fix Loop Decision Rules, and prepare reply text for every addressed or declined thread.

## Prerequisites

- Current branch is the feature branch (not `main`).
- `gh` CLI is authenticated (`gh auth status`).
- Working tree is clean before starting.

## Procedure

### Step 1: Verify Environment

```bash
gh auth status
git branch --show-current
git status
```

Confirm: authenticated, on the feature branch, working tree is clean. If the tree is dirty, stop and report — do not mix review fixes with uncommitted work.

Derive `branch-slug` (branch name with `/` replaced by `-`).

If `pr-number` is not provided, infer it:

```bash
gh pr view --json number,url,state --jq '{number,url,state}'
```

### Step 2: Fetch All Review Threads

```bash
gh pr view <number> --json number,title,url,state,reviewDecision,reviews,comments
```

This single call returns inline comments, top-level review submissions, and PR metadata. Collect all unresolved threads into a working list.

If the result has zero reviews and zero comments, report and stop:

```
**PR Comments Addressed**
No unresolved review threads. PR is clean and ready to merge.
```

### Step 3: Triage All Threads

Classify each comment into one category (process top-to-bottom in this priority order):

| Category | Criteria | Action |
|---|---|---|
| **bug / regression** | Incorrect behaviour, crash risk, data loss | Must fix |
| **architecture** | Layer violation, missing contract, wrong abstraction | Must fix |
| **convention** | TypeScript strict mode, naming, logging, file placement | Fix |
| **suggestion** | Improvement, not blocking | Apply at discretion |
| **question** | Needs a clarifying answer, no code change | Reply only |
| **intentionally-declined** | Valid comment, but explicitly disagreed with | Document reason |

Output the triage list in chat before fixing anything, so the overall picture is visible.

### Step 4: Fix Each Actionable Item (Top-Down)

For each bug, architecture, convention, and accepted suggestion — in that priority order:

1. Apply the code fix.
2. Apply the **Fix Loop Decision Rules** (AGENTS.md § Fix Loop Decision Rules) to choose validation and review scope.
3. Do not move to the next comment until validation and any required review pass.
4. Commit with a focused Conventional Commits message. Push immediately so the PR stays in a recoverable state.

For each **question**: draft a reply explaining the existing behaviour or design decision. No code change needed.

For each **intentionally-declined** item: write a brief reason in `ai/local/reviews/<branch-slug>.md` under a `## Declined Items` section.

### Step 5: Update Review File

Write or append to `ai/local/reviews/<branch-slug>.md`:

```md
# PR Review: <branch-name>

Date: <YYYY-MM-DD>
PR: <url>

## Addressed Items

- <comment summary> → fixed in `<short-hash>` (<file:line>)
- ...

## Declined Items

- <comment summary> — <reason for declining>
- ...

## Reply Notes

See below in chat output.
```

### Step 6: Prepare Reply Text

For every thread (addressed and declined), prepare a short reply paragraph:

```
**PR Reply Notes**

**Thread: <file:line or summary>**
<What was changed, or why it was declined. Commit `<short-hash>` if applicable. Ready to resolve: yes/no.>

**Thread: ...**
...
```

Print all reply notes in chat.

### Step 7: Post Replies (If Permitted)

If `gh` permissions allow replying to PR review threads directly:

```bash
gh api repos/{owner}/{repo}/pulls/<number>/comments/<comment-id>/replies \
  --method POST --field body="<reply text>"
```

Otherwise output the paste-ready text from Step 6 for the human to post manually.

### Step 8: Report Summary

```
**PR Comments Addressed**
- Fixed: <n> items (<short commit hashes>)
- Answered: <n> questions
- Declined: <n> items (reasons in review file)
- Replies ready: all threads

Details: ai/local/reviews/<branch-slug>.md
```

## Completion Criteria

- Every unresolved review thread is either fixed+pushed+validated, answered, or explicitly documented as declined with a reason.
- Each fix passed the Fix Loop Decision Rules before the next comment was started.
- Reply text exists for every thread.
- `ai/local/reviews/<branch-slug>.md` is updated.

## See Also

- `ai/commands/validate/COMMAND.md` — validation suite
- `ai/commands/review/COMMAND.md` — internal review
- `ai/skills/quality-review/SKILL.md` — review checklist and severity definitions
