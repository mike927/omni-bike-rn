# AI Workspace

This folder keeps AI-related guidance separate from app code. Treat `AGENTS.md` at the project root as the source of truth for workflow rules, naming, and lifecycle policy. This README is only a map of what lives under `ai/`.

```text
ai/
  README.md            ← you are here
  screens.md           ← screen inventory, navigation diagrams, phase gates
  local/               ← ignored per-worktree runtime state (plans, reviews, testing)
  commands/            ← active procedures invoked by name (see AGENTS.md § Commands)
    check-state/       ← bootstrap/resume session context
    next-task/         ← read plan.md and propose the next logical task to start
    start-feature/     ← workspace setup for a new feature
    review-plan/       ← review the active branch plan before implementation
    address-plan-review/ ← address plan-review findings without blindly accepting them
    validate/          ← run full validation suite
    code-review/       ← code review of branch diff (local or GitHub PR)
    open-pr/           ← open GitHub PR with standard format
    address-code-review/ ← consume review findings and fix each actionable item
    finish-feature/    ← merge PR, clean up branch/worktree
  skills/
    architecture/      ← structure, boundaries, ownership
    ble-hardware/      ← BLE scanning, FTMS parsing, device adapters
    drizzle-expo/      ← official Drizzle ORM workflow for Expo + SQLite
    expo-ui/           ← Expo Router UI, navigation, styling (from expo/skills)
    expo-upgrade/      ← Expo SDK upgrades, dependency migrations (from expo/skills)
    harness-authoring/ ← rules for creating or modifying AGENTS.md, commands, and skills
    ios-native/        ← iOS platform integration
    provider-entrypoints/ ← rules for provider-specific bridge and entrypoint files
    quality-review/    ← review checklists and quality standards
    react-native-perf/ ← RN performance, profiling, bundle size (from callstackincubator/agent-skills)
    sqlite-persistence/← Expo SQLite, session persistence rules, repositories
    stitch-design/     ← UI design with Google Stitch, MCP integration, design-to-code
```

Tracked docs and templates stay under `ai/`.

Per-branch runtime files live under `ai/local/` and are ignored by git:
- `ai/local/plans/<branch-slug>.md`
- `ai/local/reviews/<branch-slug>.md`
- `ai/local/testing/<branch-slug>.md`

Use the subfolder README or template only for folder-specific structure. For naming rules, required fields, step definitions, and cleanup policy, follow `AGENTS.md`.
