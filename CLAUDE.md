# Claude Code Entry Point

**IMPORTANT: Before proceeding with any project work, read `AGENTS.md` in full.**

@AGENTS.md

## Claude-Specific Notes

- Slash commands in `.claude/commands/` are thin pointers to `ai/commands/*/COMMAND.md` — all logic lives in the canonical command files
- Use `CLAUDE.local.md` for personal preferences not shared with the team (git-ignored)
- **Agent Roles**: When spawning subagents via the Agent tool, map Opus to complex analysis, Sonnet to focused implementation, and Haiku to codebase search.
- **Mode Switching**: Map the `AGENTS.md` planning mode requirements to your explicit `EnterPlanMode` and `ExitPlanMode` tools.
- **Code Quality Pass**: Map the `AGENTS.md` pre-review code quality pass to your native `/simplify` tool.
