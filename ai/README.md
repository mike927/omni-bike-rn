# AI Workspace

This folder keeps AI-related guidance separate from app code. Treat `AGENTS.md` at the project root as the source of truth for workflow rules, naming, and lifecycle policy. This README is only a map of what lives under `ai/`.

```text
ai/
  README.md            ← you are here
  screens.md           ← screen inventory, navigation diagrams, phase gates
  workflows/           ← tracked workflow docs and reusable templates
  local/               ← ignored per-worktree runtime state (plans, workflows, reviews, testing)
  skills/
    architecture/      ← structure, boundaries, ownership
    ble-hardware/      ← BLE scanning, FTMS parsing, device adapters
    drizzle-expo/      ← official Drizzle ORM workflow for Expo + SQLite
    expo-ui/           ← Expo Router UI, navigation, styling (from expo/skills)
    expo-upgrade/      ← Expo SDK upgrades, dependency migrations (from expo/skills)
    ios-native/        ← iOS platform integration
    quality-review/    ← code review, tests, lint, type safety
    react-native-perf/ ← RN performance, profiling, bundle size (from callstackincubator/agent-skills)
    sqlite-persistence/← Expo SQLite, session persistence rules, repositories
    stitch-design/     ← UI design with Google Stitch, MCP integration, design-to-code
```

Tracked docs and templates stay under `ai/`.

Per-branch runtime files live under `ai/local/` and are ignored by git:
- `ai/local/plans/<branch-slug>.md`
- `ai/local/workflows/<branch-slug>.md`
- `ai/local/reviews/<branch-slug>.md`
- `ai/local/testing/<branch-slug>.md`

Use the subfolder README or template only for folder-specific structure. For naming rules, required fields, step definitions, and cleanup policy, follow `AGENTS.md`.
