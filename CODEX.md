# CODEX.md

Primary contract is `AGENTS.md`. This file covers Codex-specific project notes only.

## Superpowers

Required Codex plugin:

- `superpowers@openai-curated`

Codex work in this repo should use Superpowers as the workflow core, matching `AGENTS.md`.

Install and enable Codex plugins only through official Codex plugin mechanisms (Codex plugin UI / official Codex CLI plugin commands / official marketplace flow). Do not add custom install scripts, npm scripts, shell wrappers, or app runtime hooks for Codex plugin installation.

As of April 25, 2026, Codex supports project config files, but plugin marketplace registration and plugin enable/disable state are still effectively user-scoped. This repo therefore declares the required plugin here instead of committing a non-functional `.codex/config.toml` `[plugins]` block. If Codex adds official repo-scoped plugin enablement later, use that official mechanism and keep this file as the human-readable contract.
