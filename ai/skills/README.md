# Agent Skills

Skills are **passive domain context** — loaded when a task matches their domain, never invoked as procedures. They strictly complement **commands** (which are active, multi-step procedures). See `ai/skills/harness-authoring/SKILL.md` § `Harness File Map` for the canonical definition.

## File Format

Each skill MUST live in `ai/skills/<name>/SKILL.md` and begin with this frontmatter:

```yaml
---
name: <kebab-case>
description: <one-line description of the domain and when to load this skill>
---
```

- `name` — kebab-case identifier matching the folder name.
- `description` — one line stating the domain and the trigger for loading.

Authoring rules for the body live in `ai/skills/harness-authoring/SKILL.md` § `Rules For SKILL.md`. Do not restate them here.

## Required Sections

Skills have no mandatory structural sections — the body is free-form domain reference (context, key files, patterns, known issues). Two conventions apply:

- **Title.** The first heading is an `# H1` matching the skill's human-readable name.
- **`## See Also`.** Conventional when the skill cross-references sibling skills, commands, or `AGENTS.md` sections. Omit when there is nothing to link.

## Minimal Template

```md
---
name: example-domain
description: Patterns and known issues for the example domain. Load when a task touches example-domain files.
---

# Example Domain

Domain-specific context goes here.
```

## What A Skill Should NOT Contain

See `ai/skills/harness-authoring/SKILL.md` § `Rules For SKILL.md` and § `Common Anti-Patterns`. Do not duplicate those rules here.

## Platform Invocation

Skills are agent-agnostic. The content is ALWAYS hosted here, never duplicated. If a host exposes skills through its own primitive, register a thin pointer that resolves to the canonical `ai/skills/<name>/SKILL.md`.

## See Also

- `ai/skills/harness-authoring/SKILL.md` — authoring rules, formatting, and anti-patterns for all harness files
- `ai/commands/README.md` — file format contract for commands
