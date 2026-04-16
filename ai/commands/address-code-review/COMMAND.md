---
name: address-code-review
description: >-
  Work through code review findings (local review file or GitHub PR threads),
  fix each actionable item using the Fix Loop Decision Rules, and prepare
  reply text per thread.
inputs:
  - name: source
    description: '"local" (default) processes findings already in ai/local/reviews/<branch-slug>.md. "gh" fetches PR review threads first, appends them to the same file, then processes them.'
    default: local
  - name: pr-number
    description: 'GitHub PR number. Only used when source=gh. If omitted, inferred from the current branch.'
    default: (inferred from current branch)
outputs:
  - name: fix-commits
    description: 'One or more commits addressing actionable review findings. Pushed immediately when source=gh.'
  - name: reply-notes
    description: 'Per-thread reply text printed in chat under a **PR Reply Notes** header (source=gh only).'
  - name: review-file
    description: 'ai/local/reviews/<branch-slug>.md updated with addressed and declined items.'
---

# Address Code Review

Consume code review findings and fix them. Source is either the local review file (default) or freshly-fetched GitHub PR review threads.

## Prerequisites

- Current branch is a feature branch, not `main`.
- Working tree is clean before starting. If the tree is dirty, stop and report — do not mix review fixes with uncommitted work.
- For `source: gh`: an open PR must exist and `gh` CLI must be authenticated.

## Procedure

### Step 1: Verify Environment

```bash
git branch --show-current
git status
```

Derive `branch-slug` (branch name with `/` replaced by `-`).

For `source: gh`, also run `gh auth status` to confirm authentication.

### Step 2: Load Findings

Read the `source` input. Default is `local`.

| Source  | How to load findings                                                                                         |
|---------|--------------------------------------------------------------------------------------------------------------|
| `local` | Read `ai/local/reviews/<branch-slug>.md`. If missing or empty, stop and report — nothing to address.          |
| `gh`    | Fetch unresolved PR review threads, append them to `ai/local/reviews/<branch-slug>.md`, then load the file.  |

For `source: gh`, fetch PR review threads with:

```bash
gh pr view <number> --json number,title,url,state,reviewDecision,reviewThreads
```

If `pr-number` is not provided, infer it:

```bash
gh pr view --json number,url,state --jq '{number,url,state}'
```

Collect threads where `isResolved` is `false`. Append them to `ai/local/reviews/<branch-slug>.md` under a `## PR Review Threads` section, formatted as checklists (`- [ ] <file:line> - <comment>`). If there are no unresolved threads, report and stop:

```
**Code Review Addressed**
No unresolved PR review threads. PR is clean and ready to merge.
```

### Step 3: Triage All Findings

Classify each finding into one category (process top-to-bottom in this priority order):

| Category | Criteria | Action |
|---|---|---|
| **bug / regression** | Incorrect behaviour, crash risk, data loss | Must fix |
| **architecture** | Layer violation, missing contract, wrong abstraction | Must fix |
| **convention** | TypeScript strict mode, naming, logging, file placement | Fix |
| **suggestion** | Improvement, not blocking | Apply at discretion |
| **question** | Needs a clarifying answer, no code change | Reply only (gh) or document (local) |
| **intentionally-declined** | Valid finding, but explicitly disagreed with | Document reason |

Output the triage list in chat before fixing anything, so the overall picture is visible.

### Step 4: Fix Each Actionable Item (Top-Down)

For each bug, architecture, convention, and accepted suggestion — in that priority order:

1. Apply the code fix.
2. Apply the **Fix Loop Decision Rules** (AGENTS.md § Fix Loop Decision Rules) to choose validation scope and review execution.
3. Do not move to the next finding until validation and any required review pass.
4. Commit the fix per the commit rules in `AGENTS.md`. For `source: gh`, push immediately so the PR stays in a recoverable state.

For each **question** (gh source): draft a reply explaining the existing behaviour or design decision. No code change needed.

For each **intentionally-declined** item: you will append a brief reason inline in Step 5.

### Step 5: Update Review File (In-Place)

Do NOT delete or move items to new sections. Update the findings in `ai/local/reviews/<branch-slug>.md` **in-place**.

For each finding you process, use your text replacement tool to change `[ ]` to `[x]` and append your resolution inline using the `->` symbol.

- After all actionable findings (bug, regression, convention, accepted suggestion) are marked `[x]`, update the `State:` header line from `needs-changes` to `ready`.

**Format:**
`- [x] <file:line> [<severity>] - <description> -> FIXED: <commit-hash>`
`- [x] <file:line> [<severity>] - <description> -> ANSWERED: <brief answer>`
`- [x] <file:line> [<severity>] - <description> -> DECLINED: <reason>`

*Why this matters:* Single-line replacements are safe and prevent document corruption. Do not attempt to restructure the Markdown headers.

### Step 6: Prepare Reply Text (gh source only)

For every thread (addressed and declined), prepare a short reply paragraph:

```
**PR Reply Notes**

**Thread: <file:line or summary>**
<What was changed, or why it was declined. Commit `<short-hash>` if applicable. Ready to resolve: yes/no.>

**Thread: ...**
...
```

Print all reply notes in chat.

### Step 7: Post Replies (gh source only, if permitted)

If `gh` permissions allow replying to PR review threads directly:

```bash
gh api repos/{owner}/{repo}/pulls/<number>/comments/<comment-id>/replies \
  --method POST --field body="<reply text>"
```

Otherwise output the paste-ready text from Step 6 for the human to post manually.

### Step 8: Report Summary

```
**Code Review Addressed** (<source>)
- Fixed: <n> items (<short commit hashes>)
- Answered: <n> questions
- Declined: <n> items (reasons in review file)
- Replies ready: <all threads | n/a for local source>

Details: ai/local/reviews/<branch-slug>.md
```

## Completion Criteria

- Every actionable finding is either fixed+committed (and pushed if source=gh), answered, or explicitly declined with a reason.
- Each fix passed the Fix Loop Decision Rules before the next finding was started.
- `ai/local/reviews/<branch-slug>.md` is updated.
- For `source: gh`: reply text exists for every thread.

## See Also

- `ai/commands/validate/COMMAND.md` — validation suite
- `ai/commands/code-review/COMMAND.md` — produce findings
- `ai/skills/quality-review/SKILL.md` — review checklist and severity definitions
