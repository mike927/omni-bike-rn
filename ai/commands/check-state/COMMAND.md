---
name: check-state
description: >-
  Analyze branch reality vs. local workflow state and prompt for next steps.
inputs: []
outputs:
  - name: formatted-snapshot
    description: 'A comprehensive chat message outlining Git state, MD state, discrepancies, and actionable next steps.'
---

# Check-State

Assess current context by taking a deep-dive snapshot of reality, showing it to the human, and awaiting instructions on what to do next.

## Prerequisites

- None. This command is safe to run from any state.

## Procedure

### Step 1: Check Reality

Capture the actual state of the repository.

```bash
git branch --show-current
git worktree list
git status
git log --oneline -n 3
```

- Derive the `branch-slug` (branch name with `/` replaced by `-`).
- Note if there are uncommitted files or unstaged changes.
- Note the last 3 commit subjects to understand what was actually last saved.

### Step 2: Check Workflow State

Load the intended textual state from tracking files.

1. Read `plan.md` to identify the broader goal or task.

### Step 3: Analyze Discrepancies

Cross-reference Reality vs. Workflow State using both git state and the recent commit log:
- If the branch is `main` but there are dirty files, flag the violation of core rules.
- If `git status` shows uncommitted changes but recent commits suggest implementation is complete, flag the mismatch.
- If the last commit subject implies a step that is ahead of what `plan.md` reflects (e.g., commits say "feat: add X" but plan still shows `[ ]`), flag the plan drift.
- If there is no plan file, note that this appears to be a fresh start or an untracked feature.

### Step 4: Report Check-State Snapshot

Post a highly comprehensive snapshot message in chat using this general format:

```md
**Context & Status**

**Reality Check**:
- Branch: `<name>`
- Status: `clean` or `dirty (<x> files modified)`
- Recent Commits: 
  - `short hash` - `subject`
  - `...`

**Tracking State**:
- Intended Task: `<from plan.md>`
- Asserted Task: `<from ai/local/plans/<slug>.md>`

**Analysis**:
- `<Call out any discrepancies between Reality and Tracking State here>`

**Next Steps?**
`<Provide 2-3 logical options for what to do next based on the analysis, such as committing dirty files, jumping into validation, or adding new context. Ask these interactively: always offer the concrete options as a numbered list or use the most interactive mechanism your platform provides.>`
```

### Step 5: Await Instructions

Explicitly pause execution and wait for the user to reply with what to do next. Do not spontaneously execute further logic without user consent after a check-state command.

## Completion Criteria

- The multi-vector reality check is complete.
- Discrepancies are highlighted.
- The human has a formatted snapshot and the agent has yielded control back for a decision.

## See Also
