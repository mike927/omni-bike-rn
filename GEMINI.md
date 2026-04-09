# Gemini Entry Point

**IMPORTANT: Before proceeding with any project work, read `AGENTS.md` in full.** It is the single source of truth for project context, workflow rules, branching conventions, coding standards, available skills, and available commands. Do not skip this step.

@AGENTS.md

## Gemini-Specific Notes

- Workflow procedures (`.agents/workflows/`) are thin pointers to `ai/commands/*/COMMAND.md` — all logic lives in the canonical command files
- Use `GEMINI.local.md` for personal preferences not shared with the team (git-ignored)
- Gemini has no dedicated planning mode API.
- **Rich Markdown & Artifacts**: Map the `AGENTS.md` rich-rendering rule by using the `write_to_file` tool with the `IsArtifact` flag when generating plans or reviews.
- **Terminal Execution**: Map the `AGENTS.md` CLI capabilities rule to the `run_command` tool. Satisfy `// turbo` annotations by using the `SafeToAutoRun: true` parameter.
- **Scratch Space**: Map the `AGENTS.md` isolated sandbox rule to `<appDataDir>/brain/<conversation-id>/scratch/`.
