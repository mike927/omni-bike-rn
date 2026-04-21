---
name: architecture
description: Use when adding a new feature domain, deciding where a module belongs, refactoring layer imports, resolving ownership between features/services/parsers, or making architectural calls about adapters, state, or UI/feature boundaries.
---
# Architecture

Layer rules, naming, and import direction live in `ai/skills/project-context/SKILL.md` § `Coding Conventions`. This skill adds repo-specific architectural patterns that are not covered there.

## Ownership Patterns

- `src/ui/` owns shared presentational components.
- Training state lives in Zustand-backed stores.
- BLE adapters push data into shared state; they do not own UI flow.

## Adapter Discipline

- New device support adds a new adapter implementation — do not widen an existing adapter with conditionals for a second device.
- The bike sends data and status notifications separately; the BLE adapter merges them into one callback before handing off to features.

## See Also

- `ai/skills/project-context/SKILL.md` § `Coding Conventions` — layer shape, import direction, hooks-as-public-API, contract interfaces
- `ai/skills/project-context/SKILL.md` § `Key Constraints` — HR priority, 1 Hz tick model, offline-first
- `ai/skills/ble-hardware/SKILL.md` — BLE adapter specifics
