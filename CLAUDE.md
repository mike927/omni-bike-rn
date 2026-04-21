# Claude Code Entry Point

**IMPORTANT: Before proceeding with any project work, read `AGENTS.md` in full.**

@AGENTS.md

## Claude-Specific Notes

- Slash commands in `.claude/commands/` are thin pointers to `ai/commands/*/COMMAND.md` — all logic lives in the canonical command files
- Use `CLAUDE.local.md` for personal preferences not shared with the team (git-ignored)
- **Subagent Model Mapping**: When spawning subagents via the Agent tool, map Opus to complex analysis, Sonnet to focused implementation, and Haiku to codebase search.
- **Code Quality Pass**: Map `AGENTS.md` § `Internal Review` Phase A (pre-review code quality pass) to your native `/simplify` tool.
- **Dedicated Reviewer Subagent**: Map `AGENTS.md` § `Internal Review` Phase B (deep review) to the `Agent` tool. Use a `code-reviewer` subagent type if one is defined under `.claude/agents/`, otherwise use `general-purpose`. Always pass the review brief (intent, scope boundaries, tradeoffs, plan pointer) in the `prompt` field, and instruct the subagent to execute `/code-review` end-to-end so findings land in `ai/local/reviews/<branch-slug>.md`.

## Plan Mode

- **Native tool:** Use `EnterPlanMode` / `ExitPlanMode` for plan drafting. The tool writes to `.claude/plans/`; dual-write to `ai/local/plans/<branch-slug>.md` per Workflow Artifacts.
- **`ExitPlanMode` marks the end of Plan Drafting, not Plan Approving** — the rest (banner, autonomous review loop, approval gate) follows AGENTS.md.
