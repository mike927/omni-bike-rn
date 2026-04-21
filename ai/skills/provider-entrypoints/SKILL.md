---
name: provider-entrypoints
description: Use when creating, refining, or reviewing provider-specific entrypoint files (CLAUDE.md, CODEX.md, and similar), or when deciding what belongs in a shared harness file versus a thin provider bridge.
---
# Provider Entrypoints

`AGENTS.md` remains the single source of truth for repository workflow and standards. Provider files (`CODEX.md`, `CLAUDE.md`, `GEMINI.md`, etc.) should only add execution value that cannot be inferred from `AGENTS.md` alone.

## Core Rules

- Keep provider files portable, lean, and high-signal.
- Include only provider-native capabilities, constraints, or defaults that materially improve execution.
- Exclude repository workflow, domain logic, and coding standards already covered in `AGENTS.md`.
- Skip temporary session details unless they are stable enough to matter across runs.

## Recommended Shape

- Title plus `@AGENTS.md` pointer
- `Provider-Specific Notes`
- 2-5 short bullets with one idea each

## Decision Filter

- It is unique to that provider.
- It improves quality, speed, or safety in a meaningful way.
- A reader would not infer it from `AGENTS.md`.
- It is stable enough to be worth documenting.
