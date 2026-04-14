---
name: harness-authoring
description: Rules and anti-patterns for creating or modifying harness files — AGENTS.md, COMMAND.md, SKILL.md, and related infrastructure.
---

# Harness Authoring

Use this skill when creating, editing, or reviewing any harness file: `AGENTS.md`, `ai/commands/*/COMMAND.md`, `ai/skills/*/SKILL.md`, `ai/commands/README.md`, `ai/README.md`, or provider bridge files under `.claude/`, `.agents/`, etc.

## Core Philosophy

When modifying the harness, every change must align with these three pillars:
1. **The Wizard Flow:** The workflow must feel like a guided, step-by-step wizard. The agent should strictly enforce stage boundaries, explicitly announce when a step is complete, and clearly hand off the decision to move to the next step to the human.
2. **Provider-Agnostic Core:** The harness must execute flawlessly whether running in Gemini CLI, Claude Code, Cursor, or a custom script. Never rely on host-specific UI toggles or proprietary tool names inside the core workflow.
3. **Premium, Pro Feel:** Interactions should be high-signal and low-noise. Use native interactive UI tools (like `ask_user`) when available instead of forcing the human to type text. Avoid verbose apologies, over-explaining, or lecturing the human.

## Harness File Map

| File | Role |
|---|---|
| `AGENTS.md` | Single source of truth for workflow, conventions, and project rules. Agent-agnostic. |
| `ai/commands/*/COMMAND.md` | Active procedures invoked by name. Agent-agnostic. Reference `AGENTS.md`; never duplicate it. |
| `ai/skills/*/SKILL.md` | Passive domain context loaded when relevant. Agent-agnostic. |
| `ai/commands/README.md` | File format contract for commands. Update when the command shape changes. |
| `ai/README.md` | Directory index. Update when commands or skills are added or removed. |
| Provider bridges (`.claude/commands/*.md`, etc.) | Thin pointers to canonical `COMMAND.md` files. One line only. See `ai/skills/provider-entrypoints/SKILL.md`. |

## Rules For `AGENTS.md`

- **Keep it minimal.** Avoid verbose phrasing and defensive over-explaining. State constraints simply (e.g., "Requires explicit human approval" instead of "The agent must NEVER spontaneously decide...").
- **Instruct the agent, not the human.** `AGENTS.md` is an instruction manual for the AI. Avoid writing sentences that tell the human what to type or do; instead, tell the agent how to react when the human performs an action.
- **Single source of truth.** Every workflow rule lives here once. If you find the same rule stated in a command or skill, move it here and replace the copy with a reference.
- **Agent-agnostic.** No provider-specific names, paths, or syntax. Repo-canonical paths (e.g. `ai/local/plans/<branch-slug>.md`) and shell commands are legitimate. What is banned: provider tool names ("Claude Code"), provider-managed paths (`~/.claude/plans/`), and provider-specific API syntax.
- **No duplication across sections.** If a rule is stated in Workflow Pacing, do not restate it verbatim in the numbered workflow step — a one-line cross-reference is enough.
- **Step text should add only step-specific behavior.** If a repo-wide rule already exists elsewhere in `AGENTS.md` (for example branch naming, commit style, or plan-state semantics), do not repeat that guidance inside an individual workflow step unless the step introduces a new exception or ownership boundary.
- **Loop procedures need exit conditions.** Any review-fix or review-address loop must state: the entry condition, the cycle body, which specific command and result value exits the loop, and what the next workflow step is after exit.

## Rules For `COMMAND.md`

- **Agent-agnostic.** Commands are provider-neutral procedures. Repo file paths and shell commands are legitimate and expected. What is banned: provider-specific names (e.g. "Claude Code"), paths managed by a specific AI host (e.g. `~/.claude/plans/`), and provider-specific API calls or primitives.
- **Reference, don't restate.** When a command enforces a rule defined in `AGENTS.md`, cite the section: "per `AGENTS.md` § X" or "see `AGENTS.md` § X". Do not copy the rule text into the command.
- **Commit ownership, not commit style.** If a command requires creating a commit, it should say when that commit must happen and what it should contain, but it should rely on `AGENTS.md` for global commit-style rules instead of restating message conventions inline.
- **Owned artifact construction may restate syntax when necessary.** A command that directly constructs an artifact such as a branch name or PR title may restate the required format if that detail is necessary to execute the procedure, but it should avoid re-explaining global policy that already lives in `AGENTS.md`.
- **No inline workflow-state definitions.** Prerequisites that describe workflow phase (e.g. "still in the planning phase") must reference the numbered step in `AGENTS.md`, not define the state themselves.
- **Explicit loop endpoints.** If a command participates in a loop (review → fix → re-review), its chat report must state which recommendation continues the loop, which exits it, and what the next action is after each outcome.
- **Evaluation criteria belong to one place.** If two commands share the same quality checklist, the second must cross-reference the first rather than repeat the list.
- **`See Also` is mandatory.** Every command must end with a `## See Also` section linking to related commands and skills.

## Rules For `SKILL.md`

- **Passive context only.** Skills describe domain knowledge, patterns, and known issues. They do not invoke procedures or describe workflow steps — that belongs in `AGENTS.md` or a command.
- **No duplication with `AGENTS.md`.** If the skill restates a general workflow rule, remove it.
- **Stable and reusable.** Skills contain content that applies across multiple features or tasks in that domain, not one-off instructions.

## Decision Filter — Adding Or Changing Content

Before writing or moving content into a harness file, answer:

1. **Is it technically viable?** Verify that any proposed interaction, tool use, or auto-switching behavior is actually supported by the host environments before mandating it.
2. **Is it the right file type?** Active procedure → command. Passive domain knowledge → skill. Workflow rule → `AGENTS.md`.
3. **Does it already exist?** Search for the rule before adding it. If it exists somewhere else, create a reference instead.
4. **Is it agent-agnostic?** If it names a provider, tool, or host-specific path, it belongs in a provider bridge or entrypoint, not in a shared file.
5. **Does it have a clear owner?** Each rule should live in exactly one place. If you are unsure where it belongs, prefer `AGENTS.md` over a command, and a command over a skill.

If any condition fails, do not add the content. Fix the ownership first.

## Common Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| Verbose defensive instructions ("The agent must NEVER spontaneously decide...") | State the constraint simply ("Requires explicit human approval; never auto-select") |
| Command defines its own quality criteria inline | Cross-reference the authoritative criteria in `AGENTS.md` or the primary command |
| Same rule stated in Workflow Pacing AND a numbered step | Keep the full rule in Workflow Pacing; replace the step copy with one line: "Prerequisite: see Workflow Pacing" |
| Workflow step repeats repo-wide commit or naming conventions already defined elsewhere in `AGENTS.md` | Keep only the step-specific instruction (for example when a commit must exist) and rely on the global section for commit style or naming rules |
| Command restates global commit-message conventions already defined in `AGENTS.md` | Keep the command focused on when to commit and cite `AGENTS.md` for the commit rules |
| Command strips out naming syntax that it actually needs in order to build a branch name or PR title | Keep the minimum format details required to produce the artifact, and remove only the duplicated policy explanation |
| Command prerequisite defines workflow phase without citing `AGENTS.md` step number | Replace with "Step N (Section Title) of the feature workflow in `AGENTS.md` must be complete" |
| Command loop with no exit condition | Add explicit `ready`/`revise`/`blocked` outcomes with next-step instructions for each |
| Provider-specific name or host-managed path in `AGENTS.md` or a command | Replace with generic term ("your host", "provider-specific entrypoint file"). Repo paths and shell commands are not violations. |
| `ai/README.md` not updated after adding a command or skill | Always update the directory index when adding or removing files |

## See Also

- `ai/skills/provider-entrypoints/SKILL.md` — rules specific to provider bridge and entrypoint files
- `ai/commands/README.md` — file format contract for commands
file format contract for commands
