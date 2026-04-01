# Claude Code Entry Point

@AGENTS.md

## Claude-Specific Notes

- Slash commands in `.claude/commands/` are thin pointers to `ai/commands/*/COMMAND.md` — all logic lives in the canonical command files
- Use `CLAUDE.local.md` for personal preferences not shared with the team (git-ignored)
- Model preferences: use Opus for complex multi-step work, Sonnet for focused implementation, Haiku for codebase search
- Start complex tasks in plan mode before writing code
