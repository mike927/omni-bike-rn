---
name: harness-authoring
description: Use when creating, editing, or reviewing harness files (AGENTS.md, COMMAND.md, SKILL.md, provider entrypoints). Apply the pre-flight decision filter and the anti-pattern table before writing or approving changes — they catch ownership collisions and format drift that adjacent READMEs do not cover.
---

# Harness Authoring

Use this skill when touching shared harness files. Ownership and formatting contracts live elsewhere — this skill owns the *pre-flight filter* and the *review-time anti-pattern table*, which are the parts agents most reliably miss without explicit prompting.

## Pre-Flight Decision Filter

Answer each question in order before writing or accepting a new harness rule. Stop and fix ownership before proceeding if any answer fails.

1. Is this an active procedure, passive knowledge, or workflow rule?
2. Does an existing owner already cover it?
3. Is the chosen owner the single best home?
4. Is the behavior technically supported by the target host?
5. Is the wording provider-agnostic in shared files?

## Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| Verbose defensive instructions | State the constraint simply |
| Step tells the human what to type | Rewrite as how the agent reacts |
| Mixed agent-voice and human-voice in one file | Pick one voice; shared files are agent-first |
| Inconsistent formatting across siblings | Normalize to one pattern |
| One bullet mixes multiple rules | Split it |
| Duplicate tables with the same key | Merge them |
| Loop with no entry, cycle, exit, or post-exit clause | Declare all four |
| Command repeats global policy | Keep only the local instruction; cross-link the rest |
| Command frontmatter uses scalars for `inputs` / `outputs` | Use the list-of-objects shape per `ai/commands/README.md` |
| Command procedure is a flat numbered list | Use `### Step N: <Title>` subsections to match siblings |
| Shared file uses provider-specific wording | Move it to a provider entrypoint |
| Safety warning bolted into an unrelated file | Keep the warning with its owning domain |
| New command added without matching provider bridges | Mirror to every active bridge directory per `ai/commands/README.md § Platform Invocation` |

## File-Specific Rules

- **AGENTS.md** (spine) + **`ai/workflow/*.md`** (chunked detail) — Workflow rules live across these files with one owner each: the spine carries principles, the 5-gate list, the 15-row banner table, Fix Loop Decision Rules, and pointers; `ai/workflow/gates.md`, `ai/workflow/steps.md`, and `ai/workflow/review-file.md` own the rest. Every loop must declare entry, cycle body, exit condition, and post-exit behavior.
- **COMMAND.md** — Section order is `Prerequisites` → `Procedure` → `Completion Criteria` → `See Also`. Reference workflow by stable stage names, not numbers. State only this command's commit ownership; never restate global commit policy.
- **SKILL.md** — Passive and reusable across tasks. Domain skills stay declarative — no numbered procedures, no decision trees. Meta skills may carry a decision filter but must not become procedures.
- **Provider entrypoints** — Only provider-native execution value that cannot live in shared files.

## Core Ownership Map

| File | Role |
|---|---|
| `AGENTS.md` (spine) + `ai/workflow/*.md` | Single source of truth for workflow, conventions, and project rules |
| `ai/commands/*/COMMAND.md` | Active procedures invoked by name |
| `ai/skills/*/SKILL.md` | Passive domain context loaded when relevant |
| Provider bridges | Thin pointers to canonical shared files |

## See Also

- `AGENTS.md` § `Harness Principles` for the Single Ownership contract
- `ai/skills/README.md` for SKILL.md frontmatter and body format
- `ai/commands/README.md` for COMMAND.md file format contract
- `ai/skills/provider-entrypoints/SKILL.md` for provider bridge rules
