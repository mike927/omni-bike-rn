---
name: next-task
description: >-
  Read plan.md, identify the next logical unstarted task, and propose it to the user.
inputs: []
outputs:
  - name: proposal
    description: 'A short summary proposing the next task in chat, waiting for user confirmation.'
---

# Next Task

Read the project plan, find the next logical piece of work, and ask the human if they want to start it.

## Prerequisites

- Current branch is `main`.
- Working tree is clean.

## Procedure

### Step 1: Verify State

```bash
git branch --show-current
git status --short
```

Confirm that the current branch is `main` and the working tree is clean. If either is false, stop and report the blocker. Proposing a new task implies we are ready to start fresh work from `main`.

### Step 2: Read The Plan

Read `plan.md`.

1. Scan top-down and collect up to 3 unstarted tasks (`[ ]`). 
2. Prioritize tasks located in a `Current Priority` section first.
3. If more tasks are needed to reach 3, continue scanning top-down through the earliest `Phase` sections.

If no unstarted tasks are found in the entire document, report that the plan appears complete and stop.

### Step 3: Propose The Tasks

Present the collected tasks to the user using the most interactive mechanism your platform provides (e.g., a multiple-choice UI tool like `ask_user` if available, or a numbered list in chat). 

Format the options clearly:
- **Option 1:** `[Phase/Priority Name]` - `<task description>`
- **Option 2:** `[Phase/Priority Name]` - `<task description>`
- **Option 3:** `[Phase/Priority Name]` - `<task description>`
- **Option 4:** Something else / new — the human describes what they have in mind; search `plan.md` for a matching entry or, if none exists, propose adding a new one before proceeding
- **Option 5:** Cancel / None

If your platform does not support interactive UI tools, print the options as a numbered list and explicitly pause execution, waiting for the user to reply with their choice.

### Step 4: Prepare And Handoff

Once the user selects a task (including a task sourced or created via Option 4):

1. Infer the Conventional Commits `type` based on the selected task (e.g., `feat` for new features, `fix` for bugs, `test` for tests, `docs` for documentation).
2. Derive a short, kebab-case `description` from the task title (e.g., `core-training-unit-tests`).
3. Execute the `/start-feature` command logic, passing the inferred `type` and `description` as inputs to skip the manual naming prompts in that command.

## Completion Criteria

- The next unstarted task from `plan.md` has been correctly identified.
- The proposal has been printed to the chat.
- The agent has yielded control back to the human.

## See Also

- `ai/commands/start-feature/COMMAND.md` — run this if the user approves the task
- `ai/commands/check-state/COMMAND.md` — use if the user is already on an active branch and wants to resume
