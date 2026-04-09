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

1. **Prerequisites** — what must be true before running
2. **Procedure** — numbered steps the agent executes
3. **Output Format** — what the agent produces
4. **Completion Criteria** — how the agent knows it succeeded
5. **See Also** — references to skills or other commands

## Platform Invocation

Commands are agent-agnostic. The logic is ALWAYS hosted here, never duplicated.
To expose a command to platforms, register thin pointers in the platform's workspace hook:
- **Claude:** `.claude/commands/<name>.md`
- **Gemini:** `.agents/workflows/<name>.md`
