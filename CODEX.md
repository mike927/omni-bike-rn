# Codex Entry Point

**IMPORTANT: Before proceeding with any project work, read `AGENTS.md` in full.**

@AGENTS.md

## Codex-Specific Notes

- Use `CODEX.local.md` for personal preferences not shared with the team (git-ignored)
- **Terminal Execution**: Map the `AGENTS.md` CLI capabilities rule to the `exec_command` tool.
- **Context Gathering**: Map context gathering to the `multi_tool_use.parallel` capability.
- **File Edits**: Map standard file-mutation rules to the `apply_patch` tool for focused, reviewable edits.
- **External Workflows**: Prioritize native repository-integrated plugins (PR, review, CI) over manual shell scripting when available.
