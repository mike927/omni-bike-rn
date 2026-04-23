---
name: check-state
description: >-
  Analyze local and GitHub branch reality, infer the most likely workflow phase,
  and prompt for next steps.
inputs: []
outputs:
  - name: formatted-snapshot
    description: 'A comprehensive chat message outlining Git state, local artifacts, PR state, inferred workflow phase, discrepancies, and actionable next steps.'
---

# Check-State

Assess current context by taking a deep-dive snapshot of reality, infer the most likely active workflow phase from `AGENTS.md § Phases`, show the evidence to the human, and await instructions on what to do next.

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

- Note if there are uncommitted files, unstaged changes, or ahead/behind tracking info.
- Note the last 3 commit subjects to understand what was actually last saved.

### Step 2: Check Local Workflow Artifacts

Load the workflow artifacts that should exist for an active branch.

1. Read `plan.md` to identify the broader repo goal or task.
2. If the current branch is not `main`, inspect these branch-scoped files when present:
   - `ai/local/plans/<branch-slug>.md`
   - `ai/local/reviews/<branch-slug>.md`
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
- Treat an open PR as evidence that the branch is at least at the `PR` phase of `AGENTS.md`, even if local plan artifacts are missing.
- If the PR is open and review comments exist, the `PR` phase is mid-address-loop rather than freshly opened.

### Step 4: Infer The Most Likely Workflow Phase

Cross-reference local state, local artifacts, and PR state. Infer the most likely active phase from `AGENTS.md § Phases`, and include a short confidence note.

Use these rules in order:

1. If the current branch is `main` and dirty, report `Bootstrap` blocked.
2. If the current branch is `main` and clean, report `Bootstrap` complete and ready to start a new feature (`/start-feature`).
3. If the current branch is not `main` and there is an open PR, report the `PR` phase. If incoming review comments exist, note that `/address-code-review` is the active sub-step.
4. If the current branch is not `main` and there is no PR:
   - Plan file exists, review file absent or incomplete → `Plan` phase.
   - Plan file + at least one implementation commit, no review file → `Implement` phase.
   - Plan file + review file present → `Review` or `Manual Test` phase depending on review state and whether the change is user-visible.
   - If evidence is mixed, report a bounded range (e.g., `between Implement and Review`) instead of a false precise claim.
5. If `plan.md` does not mention the branch task, describe that as `branch-local work` or `plan drift`, not automatically as a fresh start.

When evidence is incomplete, report a bounded range with a confidence note rather than forcing a single precise step.

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
- Worktree: `<main repo | worktree path>`
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

**Likely Active Phase**:
- `<Phase name from AGENTS.md § Phases>`
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

### Step 7: Present Structured Next-Step Gate

Per `AGENTS.md § Harness Principles` "Structured stops", do not end with a free-text wait. Fire a `Blocker Gate` (see `ai/workflow/gates.md § Blocker Gate`) with labeled options built from the **Next Steps?** list produced in Step 6 — typically the top 2–3 candidate actions (most likely next workflow phase, second plausible path, clarification/other). The gate's host primitive always appends an `Other` free-text escape, so the human can redirect if none of the listed options fit.

Do not spontaneously execute further logic without the human's explicit choice.

## Completion Criteria

- The local reality check is complete.
- The PR state has been checked or explicitly marked unknown.
- The most likely workflow phase has been inferred from the available evidence.
- Discrepancies are highlighted.
- The human has been presented with a structured Blocker Gate for the next move and the agent is paused awaiting the selection.

## See Also

- `AGENTS.md § Phases` — phase definitions and gate boundaries
- `ai/commands/open-pr/COMMAND.md` — PR creation and existing-PR handling
- `ai/commands/address-code-review/COMMAND.md` — PR review comment triage and fix loop
