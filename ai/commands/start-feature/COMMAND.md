---
name: start-feature
description: >-
  Set up the workspace for a new feature: confirm branch name, create a
  dedicated worktree, and print the branch slug for use in all downstream
  ai/local/ artifacts.
inputs:
  - name: description
    description: 'Short kebab-case description (e.g., "ble-metronome-engine"). Prompted if omitted.'
    default: (prompted)
  - name: type
    description: 'Conventional Commits type prefix: feat, fix, docs, refactor, etc. Inferred from plan.md if omitted.'
    default: (inferred)
outputs:
  - name: branch-name
    description: 'The created branch name (e.g., feat/ble-metronome-engine).'
  - name: branch-slug
    description: 'The branch slug used for all ai/local/ artifacts (e.g., feat-ble-metronome-engine).'
  - name: working-directory
    description: 'The directory where all subsequent work for this feature should happen.'
---

# Start Feature

Set up the workspace for a new feature task: confirm starting state, propose a branch name, create the dedicated worktree, and report the canonical `branch-slug` that all downstream artifacts must use.

## Prerequisites

- Current branch is `main`.
- Working tree is clean.
- The task either maps to an existing `plan.md` item or is explicit ad-hoc branch-local work approved by the human.

## Procedure

### Step 1: Verify Starting State

```bash
git branch --show-current
git status
```

Confirm: on `main`, working tree is clean. If either check fails, stop, report the blocker, and suggest remediation — do not create a branch from a dirty or non-`main` state.

- Not on `main` → suggest `git checkout main` (verify there is no work-in-progress to preserve first)
- Dirty working tree → suggest `git stash` to park uncommitted changes, or investigate with `git status` if the dirty files are unexpected

### Step 2: Propose Branch Name

If `type` and `description` were provided as inputs (e.g., passed from `/next-task`), skip to constructing the branch name and do not prompt the user for confirmation unless they explicitly requested it.

If they were not provided:
1. Read `plan.md` and identify the relevant unstarted task when one exists.
2. If no `plan.md` item applies, derive the branch name from the human-approved ad-hoc task.
3. Infer the Conventional Commits `type` from the task scope:
   - New capability → `feat`
   - Bug fix → `fix`
   - Documentation or workflow only → `docs`
   - Structural refactor, no behaviour change → `refactor`
4. Derive a short kebab-case `description` from the task title.

Construct the proposed branch name: `<type>/<description>`.

If the inputs were inferred rather than provided, display the proposed name and proceed automatically. The user can interrupt or correct on the next turn if needed.

### Step 3: Use The Standard Workspace Mode

There is no workspace-mode choice. New feature work always uses a dedicated worktree at `../omni-bike-rn-worktrees/<branch-slug>`.

### Step 4: Ask Workflow Track

Present the workflow track options using the most interactive mechanism your platform provides (e.g., a multiple-choice UI tool like `ask_user` if available, or a numbered list in chat):

- **Option 1:** `Standard Track` — proceed to Step 3 (Plan Drafting).
- **Option 2:** `Fast Track` — skip planning/review; proceed directly to Step 6 (Implementation In Progress). Only for ad-hoc bug fixes or minor chores.

If your platform does not support interactive UI tools, print the options as a numbered list and explicitly wait for the user's choice. Do not default silently.

### Step 5: Create The Workspace

Derive `branch-slug` = branch name with `/` replaced by `-` (e.g., `feat-ble-metronome-engine`).

Before creating, verify the branch does not already exist:

```bash
git show-ref --quiet refs/heads/<branch-name> && echo "EXISTS locally"
git ls-remote --heads origin <branch-name> | grep -q . && echo "EXISTS on remote"
```

If the branch already exists locally or remotely, stop and report — ask the user whether to resume the existing branch (use `/check-state`) or choose a different name.

Ensure the parent directory exists before adding the worktree:

```bash
mkdir -p ../omni-bike-rn-worktrees
git worktree add ../omni-bike-rn-worktrees/<branch-slug> -b <branch-name>
```

### Step 6: Confirm The Workspace

```bash
git worktree list
```

Verify the new worktree exists at the expected path and that all subsequent work will happen there.

### Step 7: Report And Pause

```
**Workspace Preparing**
- Branch: `<branch-name>`
- Slug: `<branch-slug>`
- Mode: worktree at `../omni-bike-rn-worktrees/<branch-slug>`
- Track: `<Standard | Fast Track>`
- Working directory: `../omni-bike-rn-worktrees/<branch-slug>`

Ready for <Step 3: Plan Drafting | Step 6: Implementation In Progress>.

**Next:** Proceed to <Step 3 | Step 6>?
```

Yield control. Do not proceed to the next step without user instruction.

## Completion Criteria

- The new branch exists and is active.
- `branch-slug` is printed and available for use in `ai/local/plans/<branch-slug>.md`, `ai/local/reviews/<branch-slug>.md`, and all other artifacts.
- No plan file has been created yet.
- The agent has paused and is awaiting instruction for the next workflow step selected by the chosen track (`Step 3` for Standard Track, `Step 6` for Fast Track).

## See Also

- `ai/commands/check-state/COMMAND.md` — use at session start to resume an existing branch
