# Superpowers Harness v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a minimal, tool-neutral agent-operating harness in `omni-bike-rn` with the `superpowers` plugin as workflow core.

**Architecture:** Committed primary contract (`AGENTS.md`) + thin per-tool overlays (`CLAUDE.md` filled, `CODEX.md`/`GEMINI.md` empty placeholders) + `.claude/settings.json` declaring plugin enablement and curated permissions + deny list. `.claude/settings.local.json` gitignored for per-machine overrides. `ROADMAP.md` replaces `plan.md` with 4-state tracking + Future Considerations. `docs/superpowers/README.md` documents the layout.

**Tech Stack:** Plain Markdown, JSON, git, `.gitignore`, Claude Code plugin system, Husky pre-commit.

**Spec:** `docs/superpowers/specs/2026-04-24-superpowers-harness-design.md`

**Branch:** This plan executes on `feat/superpowers-harness-v1`. All commits signed (GPG configured) and go through the existing husky pre-commit (lint + typecheck).

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `.husky/pre-commit` | Modify | Switch `lint` → `lint:fix` so autofix runs before staging |
| `AGENTS.md` | Create | Primary tool-neutral operating contract |
| `CLAUDE.md` | Create | Thin Claude Code overlay (iTerm, MCP specifics) |
| `CODEX.md` | Create (empty) | Placeholder for Codex-specific overrides |
| `GEMINI.md` | Create (empty) | Placeholder for Gemini-specific overrides |
| `plan.md` | Delete | Superseded by `ROADMAP.md` |
| `ROADMAP.md` | Create (from `plan.md`) | Unified 4-state roadmap + Future Considerations |
| `docs/superpowers/README.md` | Create | Harness guide for contributors |
| `.claude/settings.json` | Create | Committed plugin enablement + curated permissions + deny list |
| `.claude/settings.local.json` | Modify | Strip durable entries now covered by `settings.json`, drop unused MCP perms |
| `~/.claude/settings.json` | Modify (user scope) | Remove `enabledPlugins` block — each project decides for itself |
| `~/.claude/plugins/installed_plugins.json` | Modify (user scope) | Remove local-scope `superpowers` entry so it re-resolves at user scope |

---

## Task 1: Switch husky pre-commit from `lint` to `lint:fix`

**Files:**
- Modify: `.husky/pre-commit`

- [ ] **Step 1: Update the hook script**

Replace the contents of `.husky/pre-commit` with:

```sh
npm run lint:fix
npm run typecheck
```

- [ ] **Step 2: Verify**

Run: `cat .husky/pre-commit`
Expected output:
```
npm run lint:fix
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add .husky/pre-commit
git commit -m "chore: switch husky pre-commit to lint:fix

Run autofix before staging so formatting/import-order drift is corrected
automatically instead of failing the hook.
"
```

Expected: commit succeeds; pre-commit hook itself runs `lint:fix` + `typecheck` and passes.

---

## Task 2: Create `AGENTS.md` (primary contract)

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: Write the file**

Create `AGENTS.md` at repo root with this exact content:

```markdown
# AGENTS.md — omni-bike-rn

Primary operating contract for any AI coding agent working on this project. Tool-agnostic by default; per-tool overlays (e.g. `CLAUDE.md`) cover tool-specific quirks only. If an overlay contradicts this file, this file wins.

## Project identity

Indoor cycling companion app. React Native / Expo, TypeScript, Drizzle + expo-sqlite, BLE FTMS (heart rate + trainer), Apple Health, Apple Watch companion via WatchConnectivity.

## Workflow

superpowers is the workflow core — don't invent parallel flows.

## Roadmap

Active work tracked in `ROADMAP.md`. Update states (`[ ] [~] [x] [-]`) as work progresses. Unresolved or exploratory items live in its **Future Considerations** section at the bottom.

## Dev loop

Canonical scripts (invoke via `npm run <name>`):

| Script | Purpose |
|---|---|
| `start` | Start Metro bundler on port 8081 |
| `ios` | Build and run on a connected iOS device (default) |
| `ios:sim` | Build and run on iOS Simulator |
| `android` | Build and run on Android |
| `lint` | Run ESLint (check only) |
| `lint:fix` | Run ESLint with autofix |
| `typecheck` | Run `tsc --noEmit` |
| `test` | Run Jest unit tests |
| `ci:gate` | Full pre-ship check (lint + typecheck + tests) |
| `db:generate` | Generate Drizzle migration from schema changes |
| `db:check` | Verify Drizzle migrations are clean |

## Autonomy rules

Try → diagnose → auto-fix trivial → retry → escalate real issues.

### Auto (do without asking)

- `pod install`, `npx expo prebuild` (incl. `--clean` when needed)
- Kill stale port 8081, restart Metro, clear Metro cache (`expo start -c`)
- Nuke `node_modules` + `package-lock.json` and reinstall on dep weirdness
- `npm run lint:fix` before staging changes
- Add obvious missing imports when TS errors clearly point to them
- `npx expo install <pkg>` for Expo-managed deps (prefer over plain `npm install`)
- Modify `app.config.ts`, `Info.plist`, or other native config
- Delete files
- Start long operations (>2 min) without asking

### Always ask first

- `git commit` and `git push`
- Anything touching `.env` or credentials
- Database migrations (`db:generate`, drizzle schema changes)

## Git workflow

- **Never commit directly to `main`.** Before any commit, confirm the current branch is not `main`; if it is, create a feature branch first (e.g. `feat/…`, `fix/…`, `chore/…`, `docs/…`).
- Never bypass hooks with `--no-verify`. If the pre-commit hook fails, fix the root cause and create a new commit (do not `--amend`).
- Prefer small, focused commits. Never `git add -A` / `git add .` — stage files explicitly.

## Error recovery playbook

| Symptom | Auto-response |
|---|---|
| `EADDRINUSE :8081` | Kill PID on 8081, restart Metro |
| Bundler / cache errors | `expo start -c` |
| "No bundle URL present" | Verify Metro alive, reload app |
| Missing pod | `cd ios && pod install` |
| Native config drift | `npx expo prebuild --clean` |
| Dep resolution failures | Nuke `node_modules` + `package-lock.json`, reinstall |
| TS "Cannot find module" | Check if it's a missing Expo dep → `npx expo install` |
| Lint failures pre-commit | `lint:fix`, re-stage, retry commit (once) |
| Build fails repeatedly | Stop, summarize, escalate to the user |

## Escalation (stop and ask)

- Any failure that recurs after one auto-fix attempt
- Signing or provisioning errors on device builds
- Network or auth errors from external services (Strava, Apple Health)
- Anything that would require a commit, touch `.env`, or run a migration

## Platform notes

- **Bluetooth**: iOS Simulator does not support Bluetooth. Real BLE testing requires a physical device. Simulator can still exercise permission-request code paths.
- **Native modules**: `modules/apple-health-workout` and `modules/watch-connectivity` are local Expo modules. Changes to their native code require a rebuild.
- **Local overrides**: per-machine settings and evolving permission grants live in `.claude/settings.local.json` (gitignored). Create that file if it doesn't exist; commit durable changes into `.claude/settings.json` instead.
```

- [ ] **Step 2: Verify**

Run: `wc -l AGENTS.md`
Expected: between 90 and 120 lines.

Run: `head -3 AGENTS.md`
Expected first line: `# AGENTS.md — omni-bike-rn`

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md as primary agent contract

Tool-neutral operating contract (project identity, workflow, dev loop,
autonomy rules, git workflow, platform notes). Consumed by any agent
respecting the AGENTS.md convention. Per-tool overlays (CLAUDE.md etc.)
cover tool-specific quirks only.
"
```

---

## Task 3: Create `CLAUDE.md` (thin Claude Code overlay)

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write the file**

Create `CLAUDE.md` at repo root with this exact content:

```markdown
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

- Default to `npm run ios` (device build) when an iPhone is detected via `xcrun devicectl list devices`. Otherwise fall back to `npm run ios:sim`.
- Run builds in Bash with `run_in_background: true`, tail the log, report completion or errors.
- Expo detects the running Metro on port 8081 and reuses it — no Metro restart needed between rebuilds.

## Permissions and plugins

- Project plugin enablement and durable permission grants: `.claude/settings.json` (committed).
- Per-machine / evolving permission grants: `.claude/settings.local.json` (gitignored). Create it if missing.
```

- [ ] **Step 2: Verify**

Run: `wc -l CLAUDE.md`
Expected: between 25 and 50 lines.

Run: `grep -c "AGENTS.md" CLAUDE.md`
Expected: at least 1 (file references the primary contract).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md as thin Claude Code overlay

Covers Claude Code specifics only (iTerm + iterm-mcp workflow,
run_in_background for long builds, pointers to .claude/settings.json
and settings.local.json). Primary contract remains AGENTS.md.
"
```

---

## Task 4: Create empty `CODEX.md` and `GEMINI.md` placeholders

**Files:**
- Create: `CODEX.md` (empty)
- Create: `GEMINI.md` (empty)

- [ ] **Step 1: Create both files**

Run:

```bash
touch CODEX.md GEMINI.md
```

- [ ] **Step 2: Verify**

Run: `ls -la CODEX.md GEMINI.md && wc -c CODEX.md GEMINI.md`
Expected: both files exist, both zero bytes.

- [ ] **Step 3: Commit**

```bash
git add CODEX.md GEMINI.md
git commit -m "docs: add empty CODEX.md and GEMINI.md placeholders

Signal-of-intent that the harness is tool-neutral and per-tool overrides
have a designated home. Empty for v1; populate only when those tools are
actually used on this project.
"
```

---

## Task 5: Migrate `plan.md` → `ROADMAP.md` with 4-state + Future Considerations

**Files:**
- Delete: `plan.md`
- Create: `ROADMAP.md` (content derived from `plan.md`)

This task restructures the living plan. Do not preserve git history via `git mv` because the content also changes substantially — a new create + delete is clearer.

- [ ] **Step 1: Read the current `plan.md`**

Run: `cat plan.md`

Identify every task bullet and its current state character (one of `[ ]`, `[x]`, `[?]`, or other).

- [ ] **Step 2: Draft `ROADMAP.md` structure**

Create `ROADMAP.md` at repo root with this skeleton. Fill the `### Phase N` sections by copying corresponding sections from `plan.md` and applying the state-mapping rules in Step 3.

```markdown
# ROADMAP — omni-bike-rn

Active development roadmap. Update states as work progresses.

**States:**
- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done
- `[-]` — Dropped / deferred

Exploratory items that aren't committed work yet live in the **Future Considerations** section at the bottom. They move up into the active roadmap with state `[ ]` when they become real work.

---

## Phase 1 — Foundation
<!-- items copied from plan.md Phase 1, states mapped per rules below -->

## Phase 2 — App Shell
<!-- etc. -->

<!-- …repeat for every Phase section present in plan.md… -->

---

## Future Considerations

<!-- Items parked here: unresolved questions, exploratory ideas, and items that used [?] in the old plan. -->

- The single `[?]` item from the old `plan.md` lands here. Preserve the item text and its note verbatim, but drop the leading `[?]` marker (Future Considerations items are stateless).
```

- [ ] **Step 3: Apply state-mapping rules when copying items**

For each task bullet in `plan.md`:

| Old marker | New marker | Where |
|---|---|---|
| `[ ]` | `[ ]` | Active roadmap, same phase |
| `[~]` | `[~]` | Active roadmap, same phase |
| `[x]` | `[x]` | Active roadmap, same phase |
| `[?]` | (no marker — stateless) | Future Considerations |
| Any other unusual marker | Active roadmap `[ ]` with a note preserving the original annotation | — |

Preserve section headings, sub-bullets, prose notes, and ordering exactly as in `plan.md` (minus state-marker changes).

Also: remove any references to `PROJECT.md` and `ai/screens.md` (those files do not exist and we're not creating them). If a phase's prose leans heavily on one of those references, rewrite the sentence so it stands alone.

- [ ] **Step 4: Delete `plan.md`**

Run:

```bash
rm plan.md
```

- [ ] **Step 5: Verify**

Run: `ls plan.md 2>&1`
Expected: `ls: plan.md: No such file or directory`

Run: `ls ROADMAP.md && head -20 ROADMAP.md`
Expected: file exists; first lines show the title, states legend, and start of Phase 1.

Run: `grep -cE '^\- \[[ x~-]\]' ROADMAP.md`
Expected: count roughly matches (old `[ ]` count + old `[x]` count) from `plan.md` (i.e. every active item migrated; the single `[?]` did not survive as a state).

Run: `grep -c '^## Future Considerations' ROADMAP.md`
Expected: exactly `1`.

Run: `grep -c 'PROJECT.md\|ai/screens.md' ROADMAP.md`
Expected: `0` (no stale references).

- [ ] **Step 6: Commit**

```bash
git add ROADMAP.md plan.md
git commit -m "docs: migrate plan.md to ROADMAP.md with unified state system

- Rename plan.md → ROADMAP.md (full content rewrite, not git mv)
- Unify state markers on [ ] [~] [x] [-]; drop legacy [?] in favor of
  a new Future Considerations section
- Move the single legacy [?] item (wake-on-start watch issue) into
  Future Considerations with its note preserved
- Strip references to non-existent PROJECT.md and ai/screens.md
"
```

---

## Task 6: Create `docs/superpowers/README.md`

**Files:**
- Create: `docs/superpowers/README.md`

- [ ] **Step 1: Ensure directory exists**

Run: `mkdir -p docs/superpowers`

(The `specs/` and `plans/` subdirs already exist from prior work.)

- [ ] **Step 2: Write the file**

Create `docs/superpowers/README.md` with this exact content:

````markdown
# Superpowers Harness Guide

How the agent-operating harness for `omni-bike-rn` is laid out, and how to work with it.

## The model

One tool-neutral contract + thin per-tool overlays + project-scoped plugin declarations.

```
repo root/
├── AGENTS.md              ← primary contract (tool-neutral)
├── CLAUDE.md              ← Claude Code overlay (iTerm, MCP specifics)
├── CODEX.md               ← placeholder (empty)
├── GEMINI.md              ← placeholder (empty)
├── ROADMAP.md             ← active work + Future Considerations
├── .claude/
│   ├── settings.json      ← committed: plugins + permissions + deny list
│   └── settings.local.json ← gitignored: per-machine overrides
└── docs/superpowers/
    ├── README.md          ← this file
    ├── specs/             ← design specs per feature
    └── plans/             ← implementation plans per feature
```

## Plugin model

Think Rails `Gemfile`: the project *declares* dependencies (via `.claude/settings.json` → `enabledPlugins`), while the plugin *code* lives in `~/.claude/plugins/…` on the user's machine, not in the repo. Claude Code auto-resolves missing plugins from the marketplace on first session. We do not lock versions — whatever the marketplace currently publishes is what gets installed. Reproducibility is at the "which plugins" level.

Enabled plugins in this project:

| Plugin | Purpose |
|---|---|
| `superpowers` | Workflow core: brainstorm → plan → execute → verify → review → ship |
| `expo` | React Native / Expo support |
| `swift-lsp` | iOS native support |
| `frontend-design` | UI work support |
| `context7` | Up-to-date library docs |

## Running the workflow

Entry points for superpowers skills:

- `/superpowers:brainstorm` — turn an idea into a spec (`docs/superpowers/specs/YYYY-MM-DD-*.md`)
- `/superpowers:writing-plans` — turn a spec into an implementation plan (`docs/superpowers/plans/YYYY-MM-DD-*.md`)
- `superpowers:executing-plans` or `superpowers:subagent-driven-development` — execute the plan task-by-task
- `superpowers:verification` — ensure the change meets the spec
- `superpowers:code-review` — final quality gate
- `superpowers:finishing-branch` — branch cleanup and merge prep

Most of these auto-chain from brainstorming. Invoke `/superpowers:brainstorm` to kick off a new feature.

## Adding a permission

1. Do the action; Claude Code prompts for permission.
2. If it's a one-off → accept once, grant lands in `.claude/settings.local.json` (per-machine).
3. If it's likely to recur → move it into `.claude/settings.json` (committed) in a follow-up edit, prefer glob form (`Bash(git log:*)`) over individual invocations.

## Enabling a new plugin

Add it to `.claude/settings.json` → `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "new-plugin@marketplace-id": true
  }
}
```

Commit. The next session resolves it from the marketplace automatically.

If the marketplace isn't `claude-plugins-official` (built into Claude Code), also add it to `extraKnownMarketplaces` in `.claude/settings.json` so teammates cloning don't need extra user-level configuration.

## Adjusting autonomy

Autonomy rules live in `AGENTS.md`. Edit the **Auto** / **Always ask first** lists there. Keep the distinction rooted in "what happens if this goes wrong?" — trivial cleanup = Auto; side effects on user data, network, or git state = ask.

## Not in the harness (and why)

- **Custom project skills** (`.claude/skills/…`) — rely on `superpowers` + community plugins until a real gap appears.
- **Slash commands** (`.claude/commands/…`) — same reasoning.
- **`PROJECT.md`, `ai/screens.md`** — the identity paragraph in `AGENTS.md` is enough for now.
- **Pre-push `ci:gate` hook** — pre-commit already covers lint + typecheck; full `ci:gate` on every push is overkill for a solo project.
- **PR template / CI drift check** — wait until the team grows beyond solo.
- **Filled `CODEX.md` / `GEMINI.md`** — files exist as placeholders; populate when those tools are actually used.
````

- [ ] **Step 3: Verify**

Run: `wc -l docs/superpowers/README.md`
Expected: between 80 and 110 lines.

Run: `head -3 docs/superpowers/README.md`
Expected: `# Superpowers Harness Guide`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/README.md
git commit -m "docs: add superpowers harness guide

Explains the layered harness (AGENTS.md + tool overlays + project-scoped
plugin enablement), the Gemfile-style plugin model, workflow entry
points, and what's intentionally not in the harness.
"
```

---

## Task 7: Create committed `.claude/settings.json`

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: Write the file**

Create `.claude/settings.json` with this exact content:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(pwd)",
      "Bash(wc:*)",
      "Bash(diff:*)",
      "Bash(which:*)",
      "Bash(file:*)",
      "Bash(stat:*)",
      "Bash(tree:*)",
      "Bash(lsof:*)",
      "Bash(kill:*)",
      "Bash(node -v)",
      "Bash(npm -v)",
      "Bash(npm list:*)",
      "Bash(npm outdated)",
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npx expo:*)",
      "Bash(npx eslint:*)",
      "Bash(npx prettier:*)",
      "Bash(npx tsc:*)",
      "Bash(npx jest:*)",
      "Bash(pod install:*)",
      "Bash(xcrun simctl:*)",
      "Bash(xcrun devicectl:*)",
      "Bash(rm -rf node_modules)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git branch:*)",
      "Bash(git checkout:*)",
      "Bash(git switch:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git stash:*)",
      "Bash(git restore:*)",
      "Bash(git fetch:*)",
      "Bash(git pull:*)",
      "Bash(git push:*)",
      "Bash(git rebase:*)",
      "Bash(git revert:*)",
      "Bash(git mv:*)",
      "Bash(git rm:*)",
      "Bash(git ls-files:*)",
      "Bash(git rev-parse:*)",
      "Bash(git config --get:*)",
      "Bash(git config --list)",
      "Bash(git remote:*)",
      "Bash(gh pr:*)",
      "Bash(gh run:*)",
      "Bash(gh auth:*)",
      "mcp__iterm-mcp__read_terminal_output",
      "mcp__iterm-mcp__write_to_terminal",
      "mcp__iterm-mcp__send_control_character"
    ],
    "deny": [
      "Read(**/.env)",
      "Read(**/.env.*)",
      "Bash(cat .env*)",
      "Bash(cat **/.env*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean -f:*)",
      "Bash(git commit *--no-verify*)",
      "Bash(git -c commit.gpgsign=false:*)",
      "Bash(curl * | sh)",
      "Bash(curl * | bash)",
      "Bash(wget * | sh)",
      "Bash(sudo:*)",
      "Bash(su:*)",
      "Bash(rm -rf /:*)",
      "Bash(rm -rf ~:*)",
      "Bash(npm publish:*)",
      "Bash(npm install -g:*)"
    ]
  },
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "expo@claude-plugins-official": true,
    "swift-lsp@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "context7@claude-plugins-official": true
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('.claude/settings.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Verify it lists all 5 plugins**

Run: `python3 -c "import json; d=json.load(open('.claude/settings.json')); print(sorted(d['enabledPlugins']))"`
Expected: a list with exactly these 5 keys:
`['context7@claude-plugins-official', 'expo@claude-plugins-official', 'frontend-design@claude-plugins-official', 'superpowers@claude-plugins-official', 'swift-lsp@claude-plugins-official']`

- [ ] **Step 4: Verify deny list blocks the hook-bypass + gpg-bypass patterns**

Run: `python3 -c "import json; d=json.load(open('.claude/settings.json')); deny = d['permissions']['deny']; assert any('--no-verify' in x for x in deny), 'no-verify not denied'; assert any('gpgsign=false' in x for x in deny), 'gpg bypass not denied'; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json
git commit -m "feat(harness): commit .claude/settings.json with plugin + permission config

Project-scoped plugin enablement (5 plugins: superpowers, expo, swift-lsp,
frontend-design, context7) via Gemfile-style declaration. Curated allow
list replaces ~55 ad-hoc entries from settings.local.json. Deny list
blocks --no-verify, gpg-bypass, destructive git commands, env reads,
sudo, and piped network installs.
"
```

---

## Task 8: Clean `.claude/settings.local.json`

**Files:**
- Modify: `.claude/settings.local.json`

Goal: strip entries now covered by committed `settings.json`, drop unused MCP integrations (stitch, preview) the user confirmed are no longer in use, keep only truly per-machine or transient overrides.

- [ ] **Step 1: Replace file contents**

Overwrite `.claude/settings.local.json` with:

```json
{
  "permissions": {
    "allow": [
      "WebSearch",
      "WebFetch(domain:developers.openai.com)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:raw.githubusercontent.com)",
      "WebFetch(domain:claude.com)"
    ]
  }
}
```

Everything else was either:
- Moved into committed `settings.json` (git/npm/expo/xcrun/iterm-mcp tool globs).
- Stale MCP perms for integrations no longer in use (`stitch`, `Claude_Preview`, `Claude_in_Chrome`).
- One-off session permissions (`gpg --list-secret-keys …`, `pbcopy`, `Bash(git config *)` unconstrained).
- `enabledPlugins.superpowers` entry — superseded by committed `settings.json`.

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('.claude/settings.local.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Verify no `enabledPlugins` block remains here**

Run: `python3 -c "import json; d=json.load(open('.claude/settings.local.json')); assert 'enabledPlugins' not in d, 'enabledPlugins should be in committed settings.json'; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Verify gitignore still excludes this file**

Run: `git check-ignore -v .claude/settings.local.json`
Expected output contains: `.gitignore:35:.claude/settings.local.json`

No commit required — file is gitignored.

- [ ] **Step 5: Sanity-check with git status**

Run: `git status --short .claude/`
Expected: `settings.local.json` does not appear (gitignored), `settings.json` was committed in Task 7 and is clean.

---

## Task 9: Remove `enabledPlugins` from user-scope `~/.claude/settings.json`

**Files:**
- Modify: `~/.claude/settings.json` (outside the repo — user-global config)

Goal: stop enabling plugins at the user level so every project decides for itself. Enablement moves fully to committed project settings.

- [ ] **Step 1: Back up current user settings**

Run:

```bash
cp ~/.claude/settings.json ~/.claude/settings.json.bak.$(date +%Y%m%d)
```

Expected: new `.bak.YYYYMMDD` file exists.

- [ ] **Step 2: Remove `enabledPlugins` key in place**

Run:

```bash
python3 -c "
import json, pathlib
p = pathlib.Path.home() / '.claude' / 'settings.json'
d = json.loads(p.read_text())
d.pop('enabledPlugins', None)
p.write_text(json.dumps(d, indent=2) + '\n')
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 3: Verify**

Run: `python3 -c "import json, pathlib; d = json.loads((pathlib.Path.home() / '.claude' / 'settings.json').read_text()); assert 'enabledPlugins' not in d; print('OK')"`
Expected: `OK`.

Run: `python3 -c "import json, pathlib; d = json.loads((pathlib.Path.home() / '.claude' / 'settings.json').read_text()); print(sorted(d.keys()))"`
Expected: still contains `permissions`, `model`, `effortLevel`, `extraKnownMarketplaces` — just no longer `enabledPlugins`.

No commit — user-scope file, not in the repo.

---

## Task 10: Normalize `superpowers` install to user scope

**Files:**
- Modify: `~/.claude/plugins/installed_plugins.json` (outside the repo — user-global)

Goal: remove the anomalous local-scope install of `superpowers` so it re-resolves at user scope on next session, matching the other 4 plugins.

- [ ] **Step 1: Back up the installed-plugins registry**

Run:

```bash
cp ~/.claude/plugins/installed_plugins.json ~/.claude/plugins/installed_plugins.json.bak.$(date +%Y%m%d)
```

Expected: `.bak` file exists.

- [ ] **Step 2: Remove the local-scope `superpowers` entry**

Run:

```bash
python3 -c "
import json, pathlib
p = pathlib.Path.home() / '.claude' / 'plugins' / 'installed_plugins.json'
d = json.loads(p.read_text())
key = 'superpowers@claude-plugins-official'
if key in d.get('plugins', {}):
    # Keep only non-local-scope entries (there probably aren't any yet; list becomes empty => drop key)
    remaining = [e for e in d['plugins'][key] if e.get('scope') != 'local']
    if remaining:
        d['plugins'][key] = remaining
    else:
        del d['plugins'][key]
p.write_text(json.dumps(d, indent=2) + '\n')
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 3: Verify**

Run:

```bash
python3 -c "
import json, pathlib
p = pathlib.Path.home() / '.claude' / 'plugins' / 'installed_plugins.json'
d = json.loads(p.read_text())
entries = d.get('plugins', {}).get('superpowers@claude-plugins-official', [])
local = [e for e in entries if e.get('scope') == 'local']
assert not local, f'still has local-scope install: {local}'
print('OK — no local-scope superpowers remains')
"
```

Expected: `OK — no local-scope superpowers remains`.

- [ ] **Step 4: Trigger re-resolution**

On the next fresh Claude Code session opened in this project, CC will see `superpowers@claude-plugins-official` enabled in `.claude/settings.json` but not installed, and auto-install it at user scope from the built-in marketplace.

Verification (performed in the next session, not this task): `installed_plugins.json` contains `superpowers@claude-plugins-official` with `scope: "user"` and no `projectPath` field.

No commit — user-scope file, not in the repo.

---

## Task 11: Final verification — spec checklist + ci:gate

**Files:** (none modified)

Run the spec's 11-point verification checklist to confirm the harness is in its intended shape, then run `ci:gate` to ensure nothing upstream regressed.

- [ ] **Step 1: Run the spec verification checklist**

Execute each of these and confirm the expected outcome:

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | `AGENTS.md` exists and covers the listed sections | `test -f AGENTS.md && grep -c "^## " AGENTS.md` | ≥ 8 top-level sections |
| 2 | `CLAUDE.md` trimmed, references `AGENTS.md` | `test -f CLAUDE.md && grep -c "AGENTS.md" CLAUDE.md` | ≥ 1 |
| 3 | `CODEX.md` and `GEMINI.md` exist as empty | `wc -c CODEX.md GEMINI.md` | both 0 bytes |
| 4 | `ROADMAP.md` exists, `plan.md` does not | `test -f ROADMAP.md && ! test -f plan.md && echo OK` | `OK` |
| 5 | `docs/superpowers/README.md` exists, ~100 lines | `wc -l docs/superpowers/README.md` | 80–110 |
| 6 | `.gitignore` blocks `settings.local.json` only (not `.claude/*` wildcard) | `grep -E '^\.claude' .gitignore` | shows `launch.json` and `settings.local.json` entries; no wildcard |
| 7 | `.claude/settings.json` committed, 5 plugins + cleaned permissions + deny list | `python3 -c "import json; d=json.load(open('.claude/settings.json')); print(len(d['enabledPlugins']), len(d['permissions']['allow']), len(d['permissions']['deny']))"` | 3 space-separated counts: `5` / `40–60` / `≥10`. (Spec target was 30–50 allow entries; actual landed slightly over because the recovery playbook requires a broad git + expo + xcrun surface. Acceptable deviation — still a ~50% reduction from 105.) |
| 8 | `.claude/settings.local.json` gitignored and near-empty | `git check-ignore .claude/settings.local.json && wc -l .claude/settings.local.json` | ignored; ≤ 15 lines |
| 9 | `~/.claude/settings.json` has no `enabledPlugins` block | `python3 -c "import json, pathlib; d = json.loads((pathlib.Path.home() / '.claude' / 'settings.json').read_text()); assert 'enabledPlugins' not in d; print('OK')"` | `OK` |
| 10 | Fresh-clone plugin auto-resolution | (manual — performed on next session open) | all 5 plugins listed in `installed_plugins.json` at user scope, no `projectPath` |
| 11 | `npm run ci:gate` passes | `npm run ci:gate` | exit 0 |

- [ ] **Step 2: Run `ci:gate`**

Run: `npm run ci:gate`
Expected: exits 0. If it fails, diagnose (usually a lint issue in the new Markdown if lint covers it; or an unintended type regression).

- [ ] **Step 3: Sanity-check git state**

Run: `git status --short`
Expected: no uncommitted changes in tracked files (only possibly `.claude/settings.local.json` if the user has per-machine tweaks — but that's gitignored).

Run: `git log --oneline main..HEAD`
Expected: the full implementation sequence (Tasks 1-8 landed as separate signed commits plus the earlier spec commits).

- [ ] **Step 4: Write a completion summary**

Post a brief summary to the session (not a file):

```
Harness v1 complete on feat/superpowers-harness-v1. Next steps:
- Open a PR against main
- On merge, open Claude Code in a fresh clone to validate auto-resolution of plugins (Task 11 #10)
- Delete the stale chore/claude-code-rules branch (superseded by Task 1 + Task 3)
```

No commit required for this step.

---

## Done

All tasks complete. The harness is in the shape described by `docs/superpowers/specs/2026-04-24-superpowers-harness-design.md`. No follow-up tasks are blocked; the one remaining open question (the `[?]` wake-on-start watch item) is parked in `ROADMAP.md`'s Future Considerations section and doesn't block v1.
