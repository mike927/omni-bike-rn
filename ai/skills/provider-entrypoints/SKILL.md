---
name: provider-entrypoints
description: Define lean provider-specific entrypoint files (for example CODEX.md, CLAUDE.md, GEMINI.md) that extend AGENTS.md with high-value provider-native capabilities.
---
# Provider Entrypoints

Use this skill when creating or refining provider-specific files such as `CODEX.md`, `CLAUDE.md`, or `GEMINI.md`.

`AGENTS.md` remains the single source of truth for repository workflow and standards. Provider files should only add execution value that cannot be inferred from `AGENTS.md` alone.

## Goals

- Keep provider files portable across projects.
- Keep provider files lean and high-signal.
- Capture only provider-native capabilities that materially improve execution of the shared workflow.

## What To Include

- Pointer to shared instructions (for example `@AGENTS.md`).
- Provider-native capabilities worth using in this repo.
- Provider-only constraints that materially affect how work is executed.
- Optional defaults that improve consistency (for example preferred built-in review helper), if they do not duplicate shared workflow rules.

## What To Exclude

- Full restatement of repository workflow steps.
- Project architecture, domain logic, or coding standards already covered in `AGENTS.md`.
- Session-specific or temporary runtime limitations unless they are stable and consistently relevant.
- Generic tool lists that do not change execution quality.

## Decision Filter

Add a provider-specific line only if all conditions are true:

- It is unique to that provider.
- It improves quality, speed, or safety in a meaningful way.
- A reader would not infer it from `AGENTS.md`.
- It is stable enough to be worth documenting.

If any condition fails, keep it in `AGENTS.md` or omit it.

## Recommended Shape

Use this minimal structure:

1. Title and `@AGENTS.md` pointer.
2. `Provider-Specific Notes` heading.
3. 2-5 short bullets with only high-value provider-native guidance.

Prefer one idea per bullet. Keep each bullet actionable.

## Example High-Value Additions

- Explicit provider mode toggles that map to planning/implementation transitions.
- Built-in review helpers that strengthen the pre-review quality pass.
- Provider-integrated artifact or execution features that improve required workflow outputs.

## Review Checklist

- File is short and easy to scan.
- Every bullet passes the Decision Filter.
- No bullet duplicates `AGENTS.md` guidance.
- No bullet is tightly coupled to one branch or one temporary session.
