---
name: start-feature
description: >-
  Set up the workspace for a new feature: confirm branch name, ask workspace
  strategy interactively, create the branch or worktree, and print the branch slug
  for use in all downstream ai/local/ artifacts.
inputs:
  - name: description
    description: 'Short kebab-case description (e.g., "ble-metronome-engine"). Prompted if omitted.'
    default: (prompted)
  - name: type
    description: 'Conventional Commits type prefix: feat, fix, docs, refactor, etc. Inferred from plan.md if omitted.'
    default: (inferred)
  - name: workspace
    description: 'Workspace strategy: "in-place" or "worktree". Prompted interactively if omitted.'
    default: (prompted)
outputs:
  - name: branch-name
    description: 'The created branch name (e.g., feat/ble-metronome-engine).'
  - name: branch-slug
    description: 'The branch slug used for all ai/local/ artifacts (e.g., feat-ble-metronome-engine).'
  - name: working-directory
    description: 'The directory where all subsequent work for this feature should happen.'
---

# Start Feature

Set up the workspace for a new feature task: confirm starting state, propose a branch name, ask the user for their workspace strategy, create the branch or worktree, and report the canonical `branch-slug` that all downstream artifacts must use.

## Prerequisites

- Current branch is `main`.
- Working tree is clean.
- `plan.md` contains an unstarted task (`[ ]`) for the intended feature.

## Procedure

### Step 1: Verify Starting State

```bash
git branch --show-current
git status
```

Confirm: on `main`, working tree is clean. If either check fails, stop and report the blocker. Do not create a branch from a dirty or non-`main` state.

### Step 2: Propose Branch Name

1. Read `plan.md` and identify the relevant unstarted task.
2. Infer the Conventional Commits `type` from the task scope:
   - New capability → `feat`
   - Bug fix → `fix`
   - Documentation or workflow only → `docs`
   - Structural refactor, no behaviour change → `refactor`
3. Derive a short kebab-case `description` from the task title.
4. Construct the proposed branch name: `<type>/<description>`.
5. Surface it to the user for confirmation before creating anything:

```
Proposed branch: feat/ble-metronome-engine
Confirm, or reply with an alternative.
```

Do not proceed until the user confirms or provides a corrected name.

### Step 3: Ask Workspace Strategy

Present exactly two numbered options and wait for an explicit choice:

```
Workspace strategy:
1. In-Place Branch — stay in the repo root, run git checkout -b. Standard, lightweight.
2. Dedicated Worktree — create a parallel directory at ../omni-bike-rn-worktrees/<branch-slug>. Use for parallel isolation.
```

Do not default silently — this question must be answered explicitly.

### Step 4: Create The Workspace

Derive `branch-slug` = branch name with `/` replaced by `-` (e.g., `feat-ble-metronome-engine`).

**In-place branch:**

```bash
git checkout -b <branch-name>
```

**Dedicated worktree:**

```bash
git worktree add ../omni-bike-rn-worktrees/<branch-slug> -b <branch-name>
```

### Step 5: Confirm The Workspace

```bash
git branch --show-current     # for in-place
# or
git worktree list             # for worktree
```

Verify the new branch is active in the correct directory.

### Step 6: Report And Pause

```
**Workspace Ready**
- Branch: `<branch-name>`
- Slug: `<branch-slug>`
- Mode: in-place | worktree at `../omni-bike-rn-worktrees/<branch-slug>`
- Working directory: `<path>`

Ready for Step 3: Detailed Plan Prepared.
```

Yield control. Do not proceed to plan creation — that belongs to Step 3 of the Feature Workflow and requires a separate agent turn.

## Completion Criteria

- The new branch exists and is active.
- `branch-slug` is printed and available for use in `ai/local/plans/<branch-slug>.md`, `ai/local/reviews/<branch-slug>.md`, and all other artifacts.
- No plan file has been created yet.
- The agent has paused and is awaiting instruction for Step 3.

## See Also

- `ai/commands/check-state/COMMAND.md` — use at session start to resume an existing branch
