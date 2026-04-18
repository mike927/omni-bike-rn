---
name: check-state
description: >-
  Analyze local and GitHub branch reality, infer the most likely workflow step,
  and prompt for next steps.
inputs: []
outputs:
  - name: formatted-snapshot
    description: 'A comprehensive chat message outlining Git state, local artifacts, PR state, inferred workflow step, discrepancies, and actionable next steps.'
---

# Check-State

Assess current context by taking a deep-dive snapshot of reality, infer the most likely active workflow step from `AGENTS.md`, show the evidence to the human, and await instructions on what to do next.

## Prerequisites

- None. This command is safe to run from any state.

## Procedure

### Step 1: Check Local Reality

Capture the actual state of the repository.

```bash
git branch --show-current
git worktree list
git status --short --branch
git log --oneline -n 3
```

- Derive the `branch-slug` (branch name with `/` replaced by `-`).
- Note if there are uncommitted files, unstaged changes, or ahead/behind tracking info.
- Note the last 3 commit subjects to understand what was actually last saved.

### Step 2: Check Local Workflow Artifacts

Load the workflow artifacts that should exist for an active branch.

1. Read `plan.md` to identify the broader repo goal or task.
2. If the current branch is not `main`, inspect these branch-scoped files when present:
   - `ai/local/plans/<branch-slug>.md`
   - `ai/local/reviews/<branch-slug>.md`
   - `ai/local/testing/<branch-slug>.md`
3. Record whether each file exists and, if it does, read only enough to identify its role in the workflow.

Important:
- Treat missing branch-scoped files as one signal, not proof that the branch is fresh.
- If the branch already has commits or a PR, prefer those stronger signals over missing local artifacts.

### Step 3: Check GitHub PR State

If the current branch is not `main`, check whether the branch already has a PR.

Run:

```bash
gh auth status
gh pr view --json number,url,state,isDraft,reviewDecision 2>/dev/null
```

If `gh` is not authenticated or no PR exists, report that PR state is `unknown` or `none` rather than guessing.

If a PR exists:
- Record the PR number, URL, open/closed state, draft state, and review decision when available.
- Treat an open PR as evidence that the branch is at least Step 12 (`PR Open`) of `AGENTS.md`, even if local plan artifacts are missing.
- If the PR is open and review feedback is requested or actionable review comments are already known from local context, infer Step 13 or Step 14 instead of Step 12.

### Step 4: Infer The Most Likely Workflow Step

Cross-reference local state, local artifacts, and PR state. Infer the most likely active workflow step from `AGENTS.md`, and include a short confidence note.

Use these rules in order:

1. If the current branch is `main` and dirty, report Step 1 (`Bootstrapping`) blocked.
2. If the current branch is `main` and clean, report Step 1 complete and ready for Step 2 (`Workspace Preparing`).
3. If the current branch is not `main` and there is an open PR:
   - Default to Step 12 (`PR Open`) when no review activity is visible.
   - Report Step 13 (`PR Review Comments`) when review feedback is present and not yet addressed.
   - Report Step 14 (`PR Review Fix Loop`) when review feedback exists and the branch has follow-up edits or commits that appear to be addressing it.
4. If the current branch is not `main` and there is no PR:
   - Use branch-scoped plan and review artifacts to distinguish planning (Steps 3-5) from implementation/review/testing (Steps 6-11).
   - If evidence is mixed, report a bounded range such as `between Step 6 and Step 9` instead of a false precise claim.
5. If `plan.md` does not mention the branch task, describe that as `branch-local work` or `plan drift`, not automatically as a fresh start.
6. If the branch is active in the repo root instead of a dedicated feature worktree, describe that as legacy or nonstandard workspace state rather than assuming the branch is invalid.

The goal is to identify the most likely current workflow position, not to force certainty when evidence is incomplete.

### Step 5: Analyze Discrepancies

Call out mismatches between signals:
- Branch is `main` but dirty.
- Working tree is dirty even though the branch appears to be in a review, testing, or PR stage.
- Recent commits imply implementation or review fixes, but local artifacts suggest the branch never advanced.
- `plan.md` does not reflect branch-local work already present in commits or PR state.
- PR state indicates the branch is later in the workflow than local artifact presence would suggest.
- Local artifact state indicates a later stage, but the branch has no commits, no PR, or no evidence that the step actually happened.

### Step 6: Report Check-State Snapshot

Post a highly comprehensive snapshot message in chat using this general format:

```md
**Context & Status**

**Reality Check**:
- Branch: `<name>`
- Status: `clean` or `dirty (<x> files modified)`
- Worktree: `<main repo (legacy/nonstandard for feature work) | worktree path>`
- Recent Commits: 
  - `short hash` - `subject`
  - `...`

**Workflow Signals**:
- Intended Task: `<from plan.md, or "branch-local work not tracked in plan.md">`
- Local Plan: `<present | missing>`
- Local Review: `<present | missing>`
- Local Testing: `<present | missing>`
- PR State: `<none | unknown | #<n> open | #<n> closed>`
- PR URL: `<url, if any>`
- Review Decision: `<approved | changes requested | review required | unknown>`

**Likely Active Step**:
- `<Step number and title>`
- Confidence: `<high | medium | low>`
- Why:
  - `<strongest signal>`
  - `<second strongest signal>`

**Analysis**:
- `<Call out any discrepancies between Reality and Tracking State here>`

**Next Steps?**
1. `<most likely next workflow action>`
2. `<second plausible action>`
3. `<fallback or clarification path>`
```

Do not collapse the answer to only local file state. PR state must be included when available because it changes the workflow meaning of the same branch.

### Step 7: Await Instructions

Explicitly pause execution and wait for the user to reply with what to do next. Do not spontaneously execute further logic without user consent after a check-state command.

## Completion Criteria

- The local reality check is complete.
- The PR state has been checked or explicitly marked unknown.
- The most likely workflow step has been inferred from the available evidence.
- Discrepancies are highlighted.
- The human has a formatted snapshot and the agent has yielded control back for a decision.

## See Also

- `AGENTS.md` — workflow step definitions and stage boundaries
- `ai/commands/open-pr/COMMAND.md` — PR creation and existing-PR handling
- `ai/commands/address-code-review/COMMAND.md` — PR review comment triage and fix loop
