---
name: validate
description: >-
  Run the full validation suite and report pass/fail per command.
inputs:
  - name: scope
    description: 'Which checks to run: "full" (all), "quick" (lint + typecheck only), or "test" (tests only)'
    default: full
outputs:
  - name: summary
    description: 'Pass/fail summary reported in chat'
---

# Validate

Run the project validation suite and record results.

## Prerequisites

- Working directory is inside a project worktree (not the repo root on `main`).
- Dependencies are installed (`node_modules/` exists).

## Procedure

### Step 1: Determine Scope

Read the `scope` input. Default is `full`.

| Scope   | Commands to run                                          |
|---------|----------------------------------------------------------|
| `full`  | lint, typecheck, test, build:smoke                             |
| `quick` | lint, typecheck                                          |
| `test`  | test only                                                |

### Step 2: Run Validation Commands

Run each command in sequence. Record exit code and key output for each.

```bash
# full scope (run in this order)
npm run lint
npm run typecheck
npm test -- --ci --runInBand
npm run build:smoke
```

If a command fails, continue running the remaining commands so the full picture is reported.

### Step 3: Report Summary

Post a summary in chat using this format:

```
**Validation Summary** (<scope>)
- lint: ✅ / ❌
- typecheck: ✅ / ❌
- test: ✅ / ❌ (<n> passed, <m> failed)
- build:smoke: ✅ / ❌
```

Include the first relevant error line for any failing command.

## Completion Criteria

- Every command in the chosen scope has been run.
- Results are reported in chat.

## See Also

- `ai/commands/code-review/COMMAND.md` — typically run after validation passes
