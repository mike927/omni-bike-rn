# Superpowers Harness v1 — Design

**Date:** 2026-04-24
**Status:** Draft (pending user review)
**Scope:** Establish a minimal, maintainable agent-operating harness for `omni-bike-rn` with the `superpowers` plugin as the workflow core.

## Purpose

Give any AI coding agent (Claude Code primarily, but tool-neutral by default) enough context to:
- Understand the project's operating rules without rediscovering them each session.
- Run the standard superpowers workflow (brainstorm → plan → execute → verify → review → ship).
- Manage the dev loop (Metro, iOS builds, lint, tests) autonomously within agreed bounds.
- Stay lean: no custom tooling drift. Superpowers is the chief of workflow; everything else is a thin layer of support.

## Guiding Principles

1. **Superpowers is the workflow core.** No parallel custom flows. If something isn't covered by a superpowers skill, we first check whether an existing skill applies before inventing one.
2. **Tool-neutral by default.** Contract lives in `AGENTS.md` — readable by any agent that respects the `AGENTS.md` convention (Claude Code, Codex, Gemini, Copilot, etc.). Tool-specific quirks live in thin per-tool files (`CLAUDE.md`, etc.).
3. **Commit the contract; gitignore the state.** Anything that describes *how the project should be operated* is committed. Anything that is a local override, secret, or per-machine preference is gitignored.
4. **Project scope over user scope.** Plugin *enablement* and operating rules live in the repo, so a fresh clone gets a working agent environment without requiring global setup beyond having Claude Code installed.
5. **YAGNI.** v1 does only what is needed now. Templates, custom skills, per-project CI drift checks, and PR automation are explicitly deferred.

## What Already Exists (Baseline)

- `CLAUDE.md` at repo root — initial agent operating rules (autonomy levels, Metro lifecycle, error recovery playbook, git workflow). Committed in `chore/claude-code-rules` (10208da).
- `.husky/pre-commit` — runs `npm run lint:fix` then `npm run typecheck`.
- `plan.md` at repo root — phase-based living plan. References `PROJECT.md` and `ai/screens.md` which do not exist.
- `.claude/settings.local.json` — ~105 permission allow entries accumulated from ad-hoc sessions, plus `enabledPlugins.superpowers` set locally.
- `.gitignore` — currently blocks `.claude/*` entirely (line 34), meaning no Claude config is tracked.
- `~/.claude/settings.json` (user scope) — model: opus, effortLevel: high, enabledPlugins for 4 plugins, extraKnownMarketplaces for superpowers-marketplace, solid deny list.
- `~/.claude/plugins/installed_plugins.json` — 5 real plugins installed on this machine. `superpowers` is currently at **local scope** (tied to this project) as a quirk of initial install; the other 4 (`expo`, `swift-lsp`, `frontend-design`, `context7`) are at **user scope**. The harness migration normalizes all of them to user scope install + project scope enable (see Layer 3).

## Architecture

Three layers, each with a clear owner:

### Layer 1 — Project Contract (tool-neutral)

**`AGENTS.md`** — the primary, authoritative contract any agent must read first.

Contents (scaled to complexity, not padded):

- **Project identity.** One paragraph: "Indoor cycling companion app. React Native / Expo, TypeScript, Drizzle + expo-sqlite, BLE FTMS, Apple Health, Apple Watch companion."
- **Workflow.** One line: "superpowers is the workflow core — don't invent parallel flows."
- **Roadmap pointer.** One line: "Active work tracked in `ROADMAP.md`. Update states as work progresses."
- **Dev loop.** Brief list of the canonical scripts and what they do (start, ios, ios:sim, android, lint, lint:fix, typecheck, test, ci:gate).
- **Autonomy rules.** What the agent may do without asking vs. must ask for first. Imported verbatim from the existing `CLAUDE.md` autonomy section — generalized where phrasing was Claude-specific.
- **Git workflow.** Never commit to main; always branch; never `--no-verify`; stage files explicitly.
- **Platform notes.** BLE does not work in iOS Simulator; native module changes require rebuild; local overrides go in `.claude/settings.local.json` (gitignored).

Target length: 150–250 lines. Longer than a README, shorter than a handbook.

### Layer 2 — Tool-Specific Overlays (thin)

**`CLAUDE.md`** — rewritten as a thin layer on top of `AGENTS.md`.

Contents:
- One-line pointer: "Primary contract is `AGENTS.md`. This file covers Claude Code specifics only."
- iTerm + iterm-mcp workflow (Metro pane, `read_terminal_output`, `write_to_terminal`, `send_control_character`).
- Use of `run_in_background` for long builds.
- Reference to `.claude/settings.json` and `.claude/settings.local.json` for permissions / plugins.

Target length: 30–60 lines.

**Other tool overlays** (`CODEX.md`, `GEMINI.md`): not created in v1. Add when those tools are actually used on this project.

### Layer 3 — Plugin & Permission Configuration

**Mental model:** think Rails `Gemfile`. The project declares which plugins it depends on by listing them in a committed config file; the plugin code itself lives in the user's Claude Code installation (`~/.claude/plugins/…`), not in the repo. A teammate cloning the project gets the declaration; Claude Code resolves and installs any missing plugins from the marketplace on first launch. We do not lock versions — whatever the marketplace's current version is, that's what gets used. Reproducibility is at the "which plugins" level, not the "which version" level.

**`.claude/settings.json`** — committed. The project's declared Claude Code configuration.

Contains:
- `enabledPlugins`: all 5 plugins that power this project.
  - `superpowers@claude-plugins-official` — workflow core.
  - `expo@claude-plugins-official` — React Native / Expo support.
  - `swift-lsp@claude-plugins-official` — iOS native support.
  - `frontend-design@claude-plugins-official` — UI work support.
  - `context7@claude-plugins-official` — up-to-date library docs.
- `permissions.allow`: the curated, durable subset of what's currently in `settings.local.json`. Globs over individual invocations. Target size: 30–50 entries (down from ~105).
- `permissions.deny`: mirror the user-level deny list (env reads, ssh, sudo, curl|sh, destructive git, etc.) so project defaults are safe even if user settings are missing.
- No `model` or `effortLevel` — those remain user preferences.

**`.claude/settings.local.json`** — gitignored. Per-machine overrides and evolving permission grants. Starts empty (or near-empty) after v1 cleanup.

**User-scope `~/.claude/settings.json`** — the `enabledPlugins` block is removed. No more global plugin enablement; each project decides for itself. Deny list and marketplace config stay.

**Plugin installs** — stay at user scope. A single install on disk serves any project that enables the plugin. No redundant project-scope installs.

### Layer 4 — Living Plan

**`ROADMAP.md`** — renamed from `plan.md`. Two sections:

1. **Active roadmap** (main body) — unified 4-state tracking:

   | State | Meaning |
   |---|---|
   | `[ ]` | Not started |
   | `[~]` | In progress |
   | `[x]` | Done |
   | `[-]` | Dropped / deferred |

2. **Future Considerations** (bottom of file) — parking lot for exploratory items and open questions that aren't committed work yet. Items here don't use the 4-state system — they're undecided by design. When one becomes actual work, it moves up into the active roadmap with state `[ ]`.

Migration rules:
- Existing `[ ]` → `[ ]` in active roadmap.
- Existing `[x]` → `[x]` in active roadmap.
- Existing `[?]` (the wake-on-start watch item) → moved to **Future Considerations** with its original note preserved. No premature decision forced.
- References to non-existent `PROJECT.md` and `ai/screens.md` are removed. The `AGENTS.md` identity paragraph replaces the `PROJECT.md` reference. `ai/screens.md` is simply dropped — if screen specs are needed later, they can be added.

### Layer 5 — Harness Documentation

**`docs/superpowers/README.md`** — ~100 lines. Explains how the harness works so future contributors (human or agent) understand the layout without reverse-engineering it.

Contents:
- The layered model above in brief.
- Where each file lives and what it's for.
- How to run the superpowers workflow on this project (entry points: `/superpowers:brainstorm`, `/superpowers:writing-plans`, etc.).
- How to add a new permission, enable a new plugin, adjust autonomy.
- What's intentionally NOT in the harness and why (custom skills, per-project slash commands, PR templates — all deferred).

## Data Flow (How an Agent Uses the Harness)

```
Agent session start
  ↓
Read AGENTS.md (identity, workflow, autonomy, scripts)
  ↓
Read CLAUDE.md if Claude Code (iTerm specifics, etc.)
  ↓
Pick up task from ROADMAP.md OR user prompt
  ↓
Run superpowers workflow:
  brainstorm → writing-plans → executing-plans
  → verification → code-review → finishing-branch
  ↓
Update ROADMAP.md states as work progresses
  ↓
Commit on feature branch; never to main; never --no-verify
```

## Error Handling & Edge Cases

- **Conflict between AGENTS.md and CLAUDE.md.** `AGENTS.md` wins; `CLAUDE.md` is a Claude-specific overlay and only covers things AGENTS.md deliberately doesn't.
- **Conflict between project and user settings.** Project wins (Claude Code's documented precedence).
- **Teammate clones fresh and doesn't have plugins installed.** Project `enabledPlugins` triggers CC to resolve from built-in `claude-plugins-official` marketplace on first launch. No manual install step needed.
- **Permission not yet granted.** Session prompts; if the permission is durable (likely to recur), it moves to `.claude/settings.json` in a follow-up commit. If one-off, it stays in `settings.local.json`.
- **ROADMAP state ambiguity during migration.** Any item whose state is unclear goes to `[ ]` with a one-line note; the user decides.

## Testing / Verification

This is a configuration and documentation change — no runtime tests. Verification is by inspection:

1. `AGENTS.md` exists and covers the listed sections.
2. `CLAUDE.md` is trimmed and references `AGENTS.md`.
3. `ROADMAP.md` exists; `plan.md` no longer exists.
4. `docs/superpowers/README.md` exists and is ~100 lines.
5. `.gitignore` no longer blocks `.claude/*`; it blocks only `.claude/settings.local.json`.
6. `.claude/settings.json` exists, is committed, contains 5 enabled plugins + cleaned permissions + deny list.
7. `.claude/settings.local.json` exists, is gitignored, is empty (or near-empty).
8. `~/.claude/settings.json` has `enabledPlugins` removed.
9. Running Claude Code in a fresh clone (or after clearing the plugin cache) auto-enables the 5 plugins on first launch.
10. `npm run ci:gate` still passes after all changes.

## Out of Scope for v1 (Explicitly Deferred)

- **PROJECT.md** — not created. The identity paragraph in `AGENTS.md` is enough. Revisit if a longer product/architecture brief becomes genuinely useful.
- **ai/screens.md** — not created. No current consumer.
- **Project-local custom skills** (`.claude/skills/…`). Rely on superpowers + community plugins until a real gap appears.
- **Project-local slash commands** (`.claude/commands/…`). Same reasoning.
- **Pre-push `ci:gate` hook.** Pre-commit already covers lint + typecheck; full `ci:gate` on every push is overkill for a solo project.
- **PR template / CI drift check scripts.** Not until the team grows beyond solo.
- **Third-party marketplace plugin adoption.** If one is added later, `extraKnownMarketplaces` moves to project scope at that time.
- **`CODEX.md` / `GEMINI.md`.** Add when those tools are actually used here.

## Success Criteria

- A teammate (or future-me on a new laptop) clones `omni-bike-rn`, opens it in Claude Code, and within 30 seconds has a working agent that:
  - Knows the project's operating rules.
  - Has all 5 plugins resolving automatically.
  - Can run the standard superpowers workflow without prompting for setup.
- `AGENTS.md` is the only file a new tool-of-the-month needs to read to onboard.
- No custom workflow skills, slash commands, or scripts have been added. The repo stays focused on the app.
