# Agent Instructions

This file contains the always-on instructions for agents working in this repository.

## Core Sources

Read these in this order before feature work:

1. `plan.md`
2. This `AGENTS.md` file
3. Relevant files under `ai/skills/*/SKILL.md`

`plan.md` is the single source of truth for project scope and progress.

## Task States In `plan.md`

Use these task states consistently:

- `[ ]` not started
- `[~]` in progress
- `[?]` blocked or needs clarification
- `[R]` implemented and in review or waiting for approval
- `[x]` completed and approved
- `[-]` intentionally skipped or deferred

When using `[?]` or `[-]`, include a short reason in the same task line.

## Branch Rules

- Never work directly on `main`.
- Create a branch before making changes.
- Use common branch prefixes:
  - `feature/*`
  - `bugfix/*`
  - `hotfix/*`

Examples:

- `feature/ble-metronome-engine`
- `bugfix/ftms-status-parser`

## Commit Rules

- Use Conventional Commits.
- Make focused commits per meaningful sub-task, not one large commit at the end.

Examples:

- `feat: add BLE metronome engine`
- `fix: correct FTMS machine status parsing`
- `docs: update project progress in plan`

## Feature Workflow

### 0. Start From The Plan

- Open `plan.md`.
- Find the current section.
- Find the next relevant task in that section.
- Understand current progress before changing code.

### 1. Create A Branch

- Create the feature, bugfix, or hotfix branch first.
- When active implementation starts, update the relevant plan item to `[~]`.

### 2. Clarify Business Requirements Only When Needed

- Ask questions only when the missing detail is a business or product decision.
- Do not ask questions that can be answered from the repository.
- Technical implementation choices are left to the agent.
- If work is blocked on a business decision, update the plan item to `[?]` with a short reason.

### 3. Implement Autonomously

- Break the work into small, meaningful sub-tasks.
- Implement fully, not partially.
- Keep commits focused.

### 4. Run Internal Review

- After implementation, perform an internal review with another agent when available.
- The review should focus on bugs, regressions, missing tests, and architecture risks.

### 5. Review Loop

- Address review findings with the main implementation agent.
- Repeat the review/fix loop up to 3 times.
- Stop earlier if the review is already clean.
- When implementation is complete and waiting for approval, update the plan item to `[R]`.

### 6. Open A Pull Request

- If GitHub access is available, open a pull request with a concise summary.
- If GitHub access is not available, prepare the pull request summary for a human to open manually.
- While the pull request is open and waiting for review, keep the related plan item at `[R]`.
- Include:
  - what changed
  - why it changed
  - what was validated

### 7. Update The Plan After Approval

- Only mark work as `[x]` after approval.
- Use `[-]` only when work is intentionally skipped or deferred, with a short reason.
- Keep `plan.md` aligned with accepted progress, not only local code state.
- Record the approval update in a separate small commit, not inside the original implementation commit.

Example:

- `docs: mark harness refactor as approved in plan`

### 8. Human Merge

- Merge is done by a human.
- After merge, switch back to `main`.
- Start the next task from `plan.md`.

## Validation

Use normal project commands:

```bash
npm run lint
npm run typecheck
npm test -- --ci --runInBand
npm run ci:gate
npm run build:smoke
```

## Skills

Use a skill when the task clearly matches that domain.

Examples:

- `ai/skills/ble-hardware/SKILL.md` for BLE, FTMS, bike devices, or heart-rate work
- `ai/skills/quality-review/SKILL.md` for internal review and quality checks
- `ai/skills/architecture/SKILL.md` for boundaries, ownership, and structure
- `ai/skills/ios-native/SKILL.md` for iOS-specific behavior
- `ai/skills/ai-setup/SKILL.md` for work on the harness itself
