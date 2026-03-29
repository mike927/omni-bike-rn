# Claude Code Entry Point

@AGENTS.md

---

Also read before starting work:

- `plan.md` — project roadmap and current progress
- `ai/local/plans/<branch-slug>.md` — detailed plan for the active feature branch (if one exists)
- `ai/local/workflows/<branch-slug>.md` — workflow state for resume context (if one exists)
- Relevant `ai/skills/*/SKILL.md` — domain-specific context (load when the task matches)

## Claude-Specific Notes

- Use `CLAUDE.local.md` for personal preferences not shared with the team (git-ignored)
- Model preferences: use Opus for complex multi-step work, Sonnet for focused implementation, Haiku for codebase search
- Start complex tasks in plan mode before writing code
