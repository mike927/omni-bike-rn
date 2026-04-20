# Agent Commands

Commands are **active procedures** — explicitly invoked, multi-step tasks. They strictly complement **skills** (which are passive domain context).

## File Format

Each command MUST live in `ai/commands/<name>/COMMAND.md` and strictly follow this template:

```yaml
---
name: <kebab-case>
description: <one-line description>
inputs:
  - name: <param>
    description: <what it means>
    default: <value>
outputs:
  - name: <artifact>
    description: <what gets produced>
---
```

Required sections, in this order:

1. **Prerequisites** — what must be true before running
2. **Procedure** — numbered steps the agent executes
3. **Completion Criteria** — how the agent knows it succeeded
4. **See Also** — references to skills or other commands

Optional sections go between `Procedure` and `Completion Criteria`. **Output Format** is only worth adding when it holds a concrete chat or artifact template that `Procedure` steps can't express inline — never as a recap of frontmatter `outputs:`. Do not invent new top-level sections outside this order.

## Platform Invocation

Commands are agent-agnostic. The logic is ALWAYS hosted here, never duplicated. To expose a command to a specific host, register a thin pointer in that host's command directory (e.g., `.claude/commands/<name>.md`, `.agents/skills/<name>/SKILL.md`, `.gemini/commands/<name>.toml`). The bridge must do nothing more than route to the canonical `ai/commands/<name>/COMMAND.md`.
