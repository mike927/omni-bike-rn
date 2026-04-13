# Claude Code Entry Point

**IMPORTANT: Before proceeding with any project work, read `AGENTS.md` in full.**

@AGENTS.md

## Claude-Specific Notes

- Slash commands in `.claude/commands/` are thin pointers to `ai/commands/*/COMMAND.md` — all logic lives in the canonical command files
- Use `CLAUDE.local.md` for personal preferences not shared with the team (git-ignored)
- **Agent Roles**: When spawning subagents via the Agent tool, map Opus to complex analysis, Sonnet to focused implementation, and Haiku to codebase search.
- **Code Quality Pass**: Map the `AGENTS.md` pre-review code quality pass (Phase A of step 7) to your native `/simplify` tool.
- **Dedicated Reviewer Subagent**: Map the `AGENTS.md` Phase B dedicated reviewer to the `Agent` tool. Use a `code-reviewer` subagent type if one is defined under `.claude/agents/`, otherwise use `general-purpose`. Always pass the review brief (intent, scope boundaries, tradeoffs, plan pointer) in the `prompt` field, and instruct the subagent to execute `/code-review` end-to-end so findings land in `ai/local/reviews/<branch-slug>.md`.
