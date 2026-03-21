# AI Workspace

This folder keeps AI-related guidance separate from app code. The full agent workflow is driven by `AGENTS.md` at the project root. Skills here provide optional domain-specific context that agents load when a task matches.

```text
ai/
  README.md          ← you are here
  skills/
    architecture/    ← structure, boundaries, ownership
    ble-hardware/    ← BLE scanning, FTMS parsing, device adapters
    ios-native/      ← iOS platform integration
    quality-review/  ← code review, tests, lint, type safety
```
