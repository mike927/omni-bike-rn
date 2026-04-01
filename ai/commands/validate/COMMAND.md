---
name: validate
description: >-
  Run the full validation suite and report pass/fail per command.
triggers:
  - 'run validation'
  - 'validate the code'
  - 'run checks'
  - 'run lint and tests'
inputs:
  - name: scope
    description: 'Which checks to run: "full" (all), "quick" (lint + typecheck only), or "test" (tests only)'
    default: full
outputs:
  - name: summary
    description: 'Pass/fail summary reported in chat'
  - name: workflow-update
    description: 'Validation state updated in ai/local/workflows/<branch-slug>.md if the file exists'
workflow-steps:
  - 5
---

# Validate

Run the project validation suite and record results. Maps to AGENTS.md workflow step 5 (Validation Complete).

## Prerequisites

- Working directory is inside a project worktree (not the repo root on `main`).
- Dependencies are installed (`node_modules/` exists).

## Procedure

### Step 1: Determine Scope

Read the `scope` input. Default is `full`.

| Scope   | Commands to run                                          |
|---------|----------------------------------------------------------|
| `full`  | lint, typecheck, test, ci:gate, build:smoke              |
| `quick` | lint, typecheck                                          |
| `test`  | test only                                                |

### Step 2: Run Validation Commands

Run each command in sequence. Record exit code and key output for each.

```bash
# full scope (run in this order)
npm run lint
npm run typecheck
npm test -- --ci --runInBand
npm run ci:gate
npm run build:smoke
```

If a command fails, continue running the remaining commands so the full picture is reported.

### Step 3: Update Workflow File

If `ai/local/workflows/<branch-slug>.md` exists, update its **Validation State** section with:

- Date and time of the run
- Scope used
- Per-command pass/fail
- Any notable warnings or errors

### Step 4: Report Summary

Post a summary in chat using this format:

```
**Validation Summary** (<scope>)
- lint: ✅ / ❌
- typecheck: ✅ / ❌
- test: ✅ / ❌ (<n> passed, <m> failed)
- ci:gate: ✅ / ❌
- build:smoke: ✅ / ❌
```

Include the first relevant error line for any failing command.

## Completion Criteria

- Every command in the chosen scope has been run.
- Results are reported in chat.
- Workflow file is updated (if it exists).

## See Also

- `AGENTS.md` § Validation — canonical command list
- `ai/commands/review/COMMAND.md` — typically run after validation passes
