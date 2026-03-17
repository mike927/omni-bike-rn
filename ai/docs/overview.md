# AI Setup Overview

## What This Folder Is

The `ai/` folder is the project's AI workspace.

It keeps AI-related guidance separate from app code and makes the setup easier to understand.

## What "Harness" Means Here

"Harness" means the support system around the codebase.

It is not product logic.

It helps answer:

- how the AI setup is organized
- what each harness file is for
- where project truth lives
- where agent instructions live
- where reusable skills live

## Current Shape

The AI workspace is intentionally small:

```text
AGENTS.md
plan.md
ai/
  docs/
  skills/
```

This keeps the setup close to common open-source patterns:

- one root instruction file for agents
- one project plan
- one place for reusable skills
- a small docs area for human explanation

## What Lives Here

### `AGENTS.md`

This is the main instruction file for agents.

It contains:

- working rules
- feature workflow steps
- branch and commit conventions
- plan update rules

### `plan.md`

This is the single source of truth for project progress.

It tells both humans and agents:

- what is planned
- what is in progress
- what is blocked
- what is under review
- what is complete
- what was intentionally skipped

### `ai/docs/`

Written explanation for humans.

Use these docs to understand:

- what the harness is
- how the setup is organized
- what each file type means

### `ai/skills/`

Reusable skill folders using a common `SKILL.md` format.

These are optional helpers for specialized work.

They are there so an agent can load the right skill when the task clearly touches that domain, without putting all knowledge into one global file.

## Reading Order

For a human who wants to understand the setup:

1. `ai/docs/overview.md`
2. `ai/docs/elements.md`

For an agent starting feature work:

1. `plan.md`
2. `AGENTS.md`
3. relevant files under `ai/skills/*`

## Main Rule

Keep this setup simple.

- use `plan.md` for project truth
- use `AGENTS.md` for active agent instructions
- use docs for human explanation
- use standard skill folders for reusable domain knowledge

If a file is not actively helping the workflow, it should not exist.
