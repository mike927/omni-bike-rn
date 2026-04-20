# Codex Entry Point

**IMPORTANT: Before proceeding with any project work, read `AGENTS.md` in full.**

@AGENTS.md

## Codex-Specific Notes

- Use `CODEX.local.md` for personal preferences not shared with the team (git-ignored)
- **Canonical Commands**: When user intent or the workflow maps to a repo command such as `/code-review`, `/validate`, or `/open-pr`, load and follow `ai/commands/<name>/COMMAND.md`. Native Codex helpers may assist, but they do not replace the canonical command.
- **Built-In Reviews**: If Codex uses provider-native review tooling during a review, write the final result to `ai/local/reviews/<branch-slug>.md` using the canonical review-file shape from `/code-review` (`Date`, `Source`, `State`, `## Findings`, `## Summary`). Use the real review outcome for `State` (`ready` or `needs-changes`) rather than treating native review as chat-only output.
- **External Workflows**: Prefer native repository-integrated plugins for PR, review, and CI metadata/actions when they support the needed step well; fall back to shell commands when plugin coverage is insufficient or the shell path is simpler and more reliable.
