---
name: resume
description: >-
  Bootstrap or resume session context from plan, branch, and workflow state.
triggers:
  - 'resume'
  - 'where was I'
  - 'continue working'
  - 'pick up where I left off'
inputs: []
outputs:
  - name: status-message
    description: 'Workflow status message posted in chat per AGENTS.md format'
workflow-steps:
  - 0
---

# Resume

Bootstrap session context so the agent can continue work without relying on chat history. Maps to AGENTS.md workflow step 0 (Bootstrap / Resume Context).

## Prerequisites

- None. This command is safe to run from any state.

## Procedure

### Step 1: Read Core Sources

1. Read `plan.md` — identify the next relevant task or in-progress work.
2. Read `AGENTS.md` — confirm workflow rules and conventions.

### Step 2: Check Branch And Worktree

```bash
git branch --show-current
git worktree list
```

Derive the `branch-slug` (branch name with `/` replaced by `-`).

### Step 3: Load Workflow State

If the current branch is **not** `main` and `ai/local/workflows/<branch-slug>.md` exists:

1. Read the workflow file.
2. Extract: current step, completed steps, blockers, active artifacts, validation state.
3. Treat this as a **resume** — do not restart planning or implementation.

If the current branch is `main` or no workflow file exists:

1. Treat this as a **new session**.
2. Report that no in-progress work was found and suggest starting at step 1.

### Step 4: Load Relevant Skills

Based on the branch domain (inferred from branch name or plan.md task), load any matching skills from `ai/skills/`.

### Step 5: Post Workflow Status

Post a workflow status message in chat using the AGENTS.md format:

```md
Workflow status
- Task: <feature or fix name>
- Branch: <branch-name>
- Worktree: <absolute-or-relative-worktree-path>
- Current step: <number and title>
- Completed steps: <comma-separated list or none>
- Next step: <next concrete action>
- Blockers: <none or short reason>
- Active artifacts: <comma-separated paths>
```

If this is a new session with no workflow state, post:

```md
Workflow status
- Task: <inferred from plan.md or "none identified">
- Branch: <branch-name>
- Worktree: <path>
- Current step: not started
- Completed steps: none
- Next step: create worktree and begin planning (step 1)
- Blockers: none
- Active artifacts: none
```

## Completion Criteria

- Agent has full context of the current task, branch, and workflow state.
- A workflow status message has been posted in chat.
- The agent is ready to continue from the correct workflow step without asking the human to re-explain prior work.

## See Also

- `AGENTS.md` § Feature Workflow — step 0 (Bootstrap / Resume Context)
- `ai/workflows/_template.md` — workflow file structure
