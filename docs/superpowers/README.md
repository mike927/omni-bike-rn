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
│   ├── settings.json      ← committed: plugin enablement only
│   └── settings.local.json ← gitignored: permissions (allow / ask / deny), per-machine
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

## Adjusting autonomy

Autonomy is enforced mechanically by `.claude/settings.local.json` (gitignored, per-machine):

- `permissions.allow` — runs without prompting (dev-loop scripts, read-only git, expo, pods, etc.).
- `permissions.ask` — always prompts, even if a broader allow rule would match (`git commit`, `git push`, `npm run db:*`, `npx drizzle-kit`).
- `permissions.deny` — hard block (`.env` reads/writes, `--no-verify` bypass, `sudo`, destructive `rm -rf`, `curl | sh`).

More specific rules override less specific ones. To shift a command's autonomy, move it between blocks. Rule of thumb: trivial cleanup = allow; side effects on user data, network, git state = ask; categorically unsafe = deny.

## Adding a permission

1. Do the action; Claude Code prompts for permission.
2. If it's a one-off → accept once, grant lands in `.claude/settings.local.json` → `allow`.
3. Prefer broad glob patterns (`Bash(git log:*)`) over individual invocations to avoid the list growing per-SHA.

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

## Not in the harness (and why)

- **Custom project skills** (`.claude/skills/…`) — rely on `superpowers` + community plugins until a real gap appears.
- **Slash commands** (`.claude/commands/…`) — same reasoning.
- **`PROJECT.md`, `ai/screens.md`** — the identity paragraph in `AGENTS.md` is enough for now.
- **Pre-push `ci:gate` hook** — pre-commit already covers lint + typecheck; full `ci:gate` on every push is overkill for a solo project.
- **PR template / CI drift check** — wait until the team grows beyond solo.
- **Filled `CODEX.md` / `GEMINI.md`** — files exist as placeholders; populate when those tools are actually used.
