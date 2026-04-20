---
name: harness-authoring
description: Rules and anti-patterns for creating or modifying harness files — AGENTS.md, COMMAND.md, SKILL.md, and related infrastructure.
---

# Harness Authoring

Use this skill when creating, editing, or reviewing any harness file: `AGENTS.md`, `ai/commands/*/COMMAND.md`, `ai/skills/*/SKILL.md`, `ai/commands/README.md`, `ai/README.md`, or provider bridge files under `.claude/`, `.agents/`, etc.

## Guiding Principles

Apply these to every harness file before writing or accepting a change.

- **Wizard Flow.** Enforce stage boundaries. Announce Step N complete, name Step N+1, hand off the decision to the human.
- **Provider-Agnostic.** No provider names, paths, or primitives in shared files. Repo-canonical paths and shell commands are fine.
- **Agent-First.** Instructions target the agent. Describe how the agent reacts when the human acts — not what the human should type or do.
- **Concise over verbose.** State constraints simply. "Requires explicit human approval" beats "The agent must NEVER spontaneously decide...".
- **Simple over engineered.** No speculative rules or abstractions for hypothetical future cases. Add workflow complexity only when a real observed problem demands it.
- **Technically viable.** Before mandating a behavior (mode switch, tool call, UI primitive), verify it is actually supported in target host environments.
- **Style coherent.** Use consistent formatting patterns within a file and across related files. If steps use bold-label bullets, all steps use bold-label bullets.
- **Logic coherent.** Every loop, conditional, and state machine must have explicit entry condition, cycle body, and exit/proceed. No dangling loops or implicit exits.

## Formatting

Concrete patterns that make reference material scannable. Apply preemptively.

- **One rule per bullet.** A bullet carries one claim. Packing multiple commands or actors into one line forces the reader to re-parse.
- **Merge tables that share a key column.** Two tables keyed on the same column become one table with an extra column; headers stop competing.
- **Drop tautological rows.** A state-table row describing a no-op transition (e.g., "`needs-changes` stays `needs-changes` during work") carries no information.
- **Cut ceremony.** Prefer "Only `/code-review` writes `ready`" over "`/code-review` is the only command that is permitted to write `State: ready`".
- **Backticks for identifiers.** Command names, state values, file paths, and section labels always in backticks.

## Harness File Map

| File | Role |
|---|---|
| `AGENTS.md` | Single source of truth for workflow, conventions, and project rules. |
| `ai/commands/*/COMMAND.md` | Active procedures invoked by name. Reference `AGENTS.md`; never duplicate it. |
| `ai/skills/*/SKILL.md` | Passive domain context loaded when relevant. |
| `ai/commands/README.md` | File format contract for commands. Update when the command shape changes. |
| `ai/README.md` | Directory index. Update when commands or skills are added or removed. |
| Provider bridges | Thin pointers to canonical `COMMAND.md` files. One line only. |

## Rules For `AGENTS.md`

- **Single source of truth.** Every workflow rule lives here once. If found in a command or skill, move it here and replace the copy with a reference.
- **No duplication across sections.** If a rule is in Workflow Pacing, do not restate it in a numbered step — use a cross-reference.
- **Loop procedures need exit conditions.** Any loop must state: entry condition, cycle body, which result value exits, and the next step after exit.

## Rules For `COMMAND.md`

- **Reference, don't restate.** Cite `AGENTS.md` sections rather than copying rule text.
- **Commit ownership, not commit style.** State when and what to commit; rely on `AGENTS.md` for message conventions.
- **Artifact syntax may be restated.** A command building a branch name or PR title may include the required format — but not the policy behind it.
- **No inline workflow-state definitions.** Prerequisites must reference the `AGENTS.md` step by name (e.g., `Plan Approving`, `Merge And Cleanup`), not by number. Numbers shift when steps are inserted or reordered; names are stable.
- **Consistent section structure.** Every command uses the same top-level order: `## Prerequisites` → `## Procedure` → `## Completion Criteria` → `## See Also`. Additional sections (e.g., output templates) go between `## Procedure` and `## Completion Criteria`.
- **Internal step numbering is local.** `### Step 1:`, `### Step 2:` within a single command are structural, not a reference to `AGENTS.md`. Do not use `AGENTS.md` workflow-step numbers anywhere in command prose; use step names.
- **Explicit loop endpoints.** Report which recommendation continues the loop, which exits it, and what happens after each outcome.
- **Evaluation criteria belong to one place.** If two commands share a checklist, the second cross-references the first.
- **`See Also` is mandatory.** Every command ends with a `## See Also` section.

## Rules For `SKILL.md`

- **Passive context only.** Domain knowledge, patterns, known issues. No procedures or workflow steps.
- **No duplication with `AGENTS.md`.** If the skill restates a general workflow rule, remove it.
- **Stable and reusable.** Content applies across multiple features, not one-off instructions.

## Decision Filter — Adding Or Changing Content

1. **Right file type?** Active procedure → command. Passive knowledge → skill. Workflow rule → `AGENTS.md`.
2. **Already exists?** Search before adding. If it exists, create a reference instead.
3. **Single owner?** Prefer `AGENTS.md` over a command, and a command over a skill.
4. **Technically viable?** Verify proposed behavior is supported in target environments.
5. **Agent-agnostic?** Provider names or host paths belong in a provider bridge only.

If any condition fails, fix ownership first.

## Common Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| Verbose defensive instructions | State the constraint simply |
| Step instructs the human what to type | Rewrite as how the agent reacts to a human action |
| Inconsistent formatting across steps or files | Normalise to one bold-label bullet pattern |
| Bullet packs multiple commands or actors | One rule per bullet |
| Two tables keyed on the same column | Merge into one table with an extra column |
| Tautological row in a state or transition table | Drop rows that describe no-op transitions |
| Loop with no explicit exit condition | Add entry, cycle body, exit value, and proceed |
| Command defines quality criteria inline | Cross-reference the authoritative source |
| Same rule in Workflow Pacing and a numbered step | Keep in Workflow Pacing; replace step copy with a cross-reference |
| Command repeats global commit or naming conventions | Keep only the step-specific instruction |
| Prerequisite cites `AGENTS.md` by step number (`Step 4`, `§ 4`) | Reference by step name (`Plan Reviewing`) — names survive renumbering |
| Command ends without a `## See Also` section | Add it; every command ends with `See Also` |
| Command invents a top-level section order | Use `Prerequisites` → `Procedure` → `Completion Criteria` → `See Also` |
| Provider-specific name in a shared file | Replace with "your host"; repo paths are not violations |
| `ai/README.md` not updated after adding a file | Always update the directory index |
| Speculative rule added "for future flexibility" | Remove it; add complexity only when a real problem demands it |

## See Also

- `ai/skills/provider-entrypoints/SKILL.md` — rules for provider bridge and entrypoint files
- `ai/commands/README.md` — file format contract for commands
