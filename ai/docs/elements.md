# AI Setup Elements

## Purpose

This file explains the AI setup in simple language:

- what the AI setup is
- what each part does
- why the setup is split into plan, agent instructions, docs, and skills

This file is for humans who want to understand how the setup works.

## What The AI Setup Is

The `ai/` folder is the project's AI workspace.

It keeps the AI-related setup in one place so it does not get mixed with app code.

It helps with:

- understanding the project
- understanding how agents are guided
- understanding when skills are useful
- keeping the AI setup small and readable

## The Main Idea

Each part of the AI setup has one clear job:

- `plan.md` tracks the project
- `AGENTS.md` tells the agent how to work
- `ai/docs/*` explains the setup to humans
- `ai/skills/*` provides reusable domain knowledge

That split keeps the setup easier to read and less dependent on one AI provider.

## What Each Part Does

### `plan.md`

This is the main project tracker.

It is the single source of truth for:

- roadmap progress
- current task state
- blocked items
- skipped items

If someone wants to know where the project stands, they should start here.

### `AGENTS.md`

This is the main instruction file for agents.

It contains:

- working rules
- branch rules
- commit rules
- the feature workflow
- plan state usage

This is where behavior belongs.

Examples:

- "Never work directly on `main`"
- "Use Conventional Commits"
- "Only mark `[x]` after approval"

### `ai/docs/`

This folder contains human-facing explanation.

Use it for:

- understanding the harness
- understanding what each file type means
- understanding why the setup is organized this way

Current docs:

- `overview.md`
- `elements.md`

Rule of thumb:

If the file mainly explains something, it belongs here.

### `ai/skills/`

This folder contains the actual skills.

Each skill uses a familiar skill-folder pattern:

```text
skill-name/
  SKILL.md
```

Current skills:

- `ai/skills/ble-hardware/SKILL.md`
- `ai/skills/quality-review/SKILL.md`
- `ai/skills/architecture/SKILL.md`
- `ai/skills/ai-setup/SKILL.md`
- `ai/skills/ios-native/SKILL.md`

This is useful because it gives you a stable, easy-to-recognize skill format.

If you later download or copy a skill from another repo that follows the same `SKILL.md` pattern, it will fit much more naturally into this project.

Rule of thumb:

If something is a reusable skill, keep it as its own folder with a `SKILL.md` file.

Skills are optional helpers, not the main workflow file.

They should support `AGENTS.md`, not replace it.

## Docs Vs Rules Vs Skills

### Docs

Docs explain the setup to humans.

Example:

- "The `ai/` folder keeps harness files separate from app code."

### Rules

Rules tell the agent what it must or must not do.

Examples:

- "Never work directly on `main`."
- "Create a branch before making changes."
- "Update `plan.md` only after approval."

These belong in `AGENTS.md`.

### Skills

Skills help with a specific type of work.

Examples:

- BLE guidance
- architecture guidance
- code review guidance
- iOS-specific guidance

These belong in `ai/skills/*/SKILL.md`.

## Why Skills Use `SKILL.md`

The project now keeps skills in a simple skill-folder format:

```text
ai/skills/<skill-name>/SKILL.md
```

This is useful because:

- it is easy to understand
- the skill is self-contained
- it is easier to copy skills in from other repos
- it avoids hiding skill guidance inside one big JSON file

What the skill file does:

- explains when the skill should be used
- gives the main skill purpose
- points to the most relevant project files

## How To Add A New Skill Later

If you want to add a new skill from another repo later, the clean way is:

1. Copy the skill folder into `ai/skills/<skill-name>/`
2. Make sure it contains `SKILL.md`
3. Make sure the file has frontmatter with `name` and `description`
4. Adjust the skill text if it needs project-specific details
5. Reference it from your workflow or load it when the task needs it

This keeps the setup standard and avoids custom one-off skill formats.

## Real Example Of The Split

Feature example:

```text
implement the next BLE task from the project plan
```

Which files matter:

1. Read `plan.md`.
2. Read `AGENTS.md` for the working rules and steps.
3. Use `ai/skills/ble-hardware/SKILL.md` because the task touches BLE.
4. Use `ai/docs/*` only if someone wants to understand the harness itself.

## Why This Is A Good Balance

This setup is:

- not tied to one provider
- not overbuilt
- easy to read
- based on normal docs plus normal skill folders
- centered on your real feature workflow instead of a custom router

## Short Summary

Use this mental model:

- `plan.md` tracks the project
- `AGENTS.md` guides the agent
- docs explain the setup to humans
- skills provide reusable domain knowledge
