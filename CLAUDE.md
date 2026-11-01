# CLAUDE.md

Primary contract is `AGENTS.md`. This file covers Claude Code specifics only.

## Execution surfaces

- **Terminal panel (Metro only)**: start Metro with `run_in_terminal` (`npm start`, title `Metro`), read its output with `read_terminal`, stop it with `stop_terminal_tab`. Check `list_terminal_tabs` first and reuse an existing Metro tab. Lifecycle rules: `AGENTS.md` → Dev loop → Metro.
- **Claude Code Bash** — everything else: native builds, pods, prebuild, lint, typecheck, tests, git, ad-hoc scripts. Long-running commands go `run_in_background: true`, tailed until completion.

## Builds

- Run builds in Bash with `run_in_background: true`, tail the log, report completion or errors.

## Permissions

Grants (allow / ask / deny) live in `.claude/settings.local.json` (gitignored, per-machine). Create it if missing.

## Plugins

Declared in `.claude/settings.json → enabledPlugins` (committed). Plugin code lives outside the repo (`~/.claude/plugins/…`) and is resolved from the marketplace on first session. No version pinning — reproducibility is at the "which plugins" level.
