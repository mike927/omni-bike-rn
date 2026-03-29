# Plan: Workflow Overhaul For Worktrees, Resume State, And Cleanup

Branch: `feature/agent-workflow-overhaul`

## Summary

Update the repository workflow docs so agents always work from dedicated Git worktrees, keep a durable branch-scoped workflow state file for handoff and resume, report their current workflow step clearly in conversation, and clean up stale local worktrees after merge.

## Key Changes

- Update `AGENTS.md` so the repo root on `main` is a coordination and read-only workspace, while all implementation-capable tasks happen from dedicated worktrees under `../omni-bike-rn-worktrees/<branch-slug>`.
- Replace the current feature workflow section with explicit workflow checkpoints from bootstrap through post-merge cleanup.
- Require a consistent workflow status message in conversation that reports the task, branch, worktree, current step, completed steps, next step, blockers, and active artifacts.
- Add a tracked workflow file contract at `ai/workflows/<branch-slug>.md`, along with a `README` and reusable template for future branches.
- Align `plan.md` and `AGENTS.md` on `[~]` as the only in-progress task marker.
- Update `ai/README.md` so the AI workspace structure documents the new `ai/workflows/` folder and the shared `branch-slug` naming convention.

## Public Interfaces / Team Contracts

- New tracked team artifact: `ai/workflows/<branch-slug>.md`
- New naming contract: `branch-slug` is the branch name with `/` replaced by `-`, reused across `ai/plans/`, `ai/workflows/`, `ai/reviews/`, and `ai/testing/`
- New conversation contract: agents must post the required workflow status message at session start, on workflow-step transitions, when blocked, and before waiting on human approval or testing
- New local cleanup contract: once a branch is merged and safely stale, the agent should remove the local worktree

## Test Plan

- Verify `AGENTS.md`, `plan.md`, and `ai/README.md` describe the same task-state legend and workflow artifacts without contradictions.
- Verify the new `ai/workflows/README.md` and `_template.md` cover the required fields for branch-scoped workflow state.
- Verify the documented workflow steps cover both new-task bootstrap on `main` and resume behavior in an existing non-`main` worktree.
- Verify the cleanup step clearly distinguishes safe stale-worktree deletion from blocked cases such as dirty worktrees, unpushed commits, or uncertain merge status, and that it removes branch-scoped AI artifact files alongside the stale worktree.

## Assumptions And Defaults

- Default worktree root: `../omni-bike-rn-worktrees/`
- Workflow state is tracked in git per branch, not kept only in chat history
- Branch-scoped AI artifact files are temporary and should be removed as part of safe post-merge cleanup
- Stale-worktree cleanup applies to local filesystem state, not to unmerged or uncertain branch state
