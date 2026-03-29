# AI Workspace

This folder keeps AI-related guidance separate from app code. Treat `AGENTS.md` at the project root as the source of truth for workflow rules, naming, and lifecycle policy. This README is only a map of what lives under `ai/`.

```text
ai/
  README.md            ← you are here
  plans/               ← per-branch implementation plans
  workflows/           ← per-branch workflow state for resume / handoff
  reviews/             ← per-branch review notes when a durable review file is useful
  testing/             ← saved human-requested testing checklists
  skills/
    architecture/      ← structure, boundaries, ownership
    ble-hardware/      ← BLE scanning, FTMS parsing, device adapters
    expo-ui/           ← Expo Router UI, navigation, styling (from expo/skills)
    expo-upgrade/      ← Expo SDK upgrades, dependency migrations (from expo/skills)
    ios-native/        ← iOS platform integration
    quality-review/    ← code review, tests, lint, type safety
    react-native-perf/ ← RN performance, profiling, bundle size (from callstackincubator/agent-skills)
    stitch-design/     ← UI design with Google Stitch, MCP integration, design-to-code
```

Use the subfolder README or template only for folder-specific structure. For naming rules, required fields, step definitions, and cleanup policy, follow `AGENTS.md`.
