# CLAUDE.md

Primary contract is `AGENTS.md`. This file covers Claude Code specifics only.

## Execution surfaces

- **iTerm (single pane, Metro only)** — home for the dev server. Independent of the Claude Code session: survives `/clear`, session restarts, laptop sleep. Managed via the `iterm-mcp` MCP tools: `write_to_terminal`, `read_terminal_output`, `send_control_character`.
- **Claude Code Bash** — everything else: native builds, pods, prebuild, lint, typecheck, tests, git, ad-hoc scripts. Long-running commands go `run_in_background: true`, tailed until completion.

**State principle:** never trust memory about Metro's state. Before any action, check reality — `lsof -i :8081` and `read_terminal_output` on the iTerm pane. If reality doesn't match memory, reality wins.

## Metro lifecycle

- **Start**: if port 8081 is free and no iTerm Metro pane exists, run `npm start` in iTerm. Otherwise detect and reuse.
- **Restart**: diagnose first — pressing `r` in the Metro pane is often enough. If not, Ctrl+C (via `send_control_character`), then `npm start`.
- **Kill**: Ctrl+C in iTerm; if orphaned on port 8081, `kill` the PID via Bash.
- **Keystrokes** (`r`, `i`, `j`, `m`): peek iTerm first via `read_terminal_output` to confirm Metro is the focused pane. If another pane is focused, ask the user to click the Metro pane before sending keys.

## Builds

- Run builds in Bash with `run_in_background: true`, tail the log, report completion or errors.

## Permissions

Grants (allow / ask / deny) live in `.claude/settings.local.json` (gitignored, per-machine). Create it if missing.

## Plugins

Declared in `.claude/settings.json → enabledPlugins` (committed). Plugin code lives outside the repo (`~/.claude/plugins/…`) and is resolved from the marketplace on first session. No version pinning — reproducibility is at the "which plugins" level.
