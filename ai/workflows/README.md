# Workflow Files

This folder stores tracked workflow state per active branch.

Use one file here for each active branch so a new conversation can resume without reconstructing context from chat history alone.

## What Belongs Here

- Branch identity and worktree location
- The current workflow step plus enough progress context for another agent to resume
- Validation, manual-testing, PR, and handoff notes that are specific to that branch

## When To Create Or Update

- Create the workflow file as soon as a dedicated worktree and branch are established.
- Update it whenever the workflow step changes, the task becomes blocked, validation status changes, manual testing starts or finishes, PR status changes, or a handoff note would help another agent resume work quickly.
- Keep it concise but complete enough that a fresh agent can continue without relying on prior chat history.

## Source Of Truth

- `AGENTS.md` defines the naming rules, required workflow steps, and lifecycle policy.
- `_template.md` in this folder provides the structure for a new branch workflow file.

Keep this README focused on the purpose of the `ai/workflows/` folder. Do not duplicate workflow policy here when `AGENTS.md` already defines it.
