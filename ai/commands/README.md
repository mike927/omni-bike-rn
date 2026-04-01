# Commands

Commands are **active procedures** — explicitly invoked, multi-step tasks that an agent executes start to finish. They complement **skills** (passive reference material loaded when the domain matches).

## When To Use A Command

Use a command when the task is a specific, repeatable procedure rather than general domain exploration. Common triggers:

- The user asks for a review, PR, validation run, or session resume
- A workflow step in `AGENTS.md` calls for a procedure that has a matching command
- The user invokes a platform-specific shortcut (e.g., Claude Code slash command) that maps to a command

## File Format

Each command lives in its own directory under `ai/commands/<name>/` with a `COMMAND.md` file.

```yaml
---
name: <kebab-case, matches directory name>
description: >-
  <one-line description — used by agents to decide relevance>
triggers:
  - <natural-language phrases that match this command>
inputs:
  - name: <param>
    description: <what it means>
    default: <value>
outputs:
  - name: <artifact>
    description: <what gets produced>
workflow-steps:
  - <AGENTS.md step number(s) this command implements>
---
```

Body sections:

1. **Prerequisites** — what must be true before running
2. **Procedure** — numbered steps the agent executes
3. **Output Format** — what the agent produces (file, chat message, or both)
4. **Completion Criteria** — how the agent knows the command succeeded
5. **See Also** — references to skills, AGENTS.md sections, or other commands

## How Commands Relate To Skills

A command may **reference** a skill when it needs domain context during execution (e.g., the `review` command loads the quality-review skill's checklist). Skills never contain procedural workflows — those belong in commands.

## Adding A New Command

1. Create a folder at `ai/commands/<command-name>/`.
2. Add a `COMMAND.md` file with YAML frontmatter and the body sections above.
3. Write the procedure as numbered steps with clear completion criteria.
4. Reference it from `AGENTS.md` § Commands.

## Platform Invocation

Commands are agent-agnostic. Each platform invokes them through its native mechanism:

- **Claude Code**: Slash commands via `.claude/commands/<name>.md` (thin pointers to `COMMAND.md`)
- **Gemini**: Natural language matching against the `triggers` field
- **Codex**: Task-based invocation; entry-point file references `AGENTS.md` § Commands

The procedure itself is always read from `ai/commands/<name>/COMMAND.md` — never duplicated into provider config.
