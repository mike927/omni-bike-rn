---
name: quality-review
description: Use when reviewing branch diffs for logic regressions, scope drift, mock quality, and test coverage gaps.
---
# Quality Review

## Review Checklist

- [ ] Logic matches the plan item — no scope creep, no missing behaviour
- [ ] Edge cases handled (null, empty, disconnected state)
- [ ] No unnecessary duplication of UI or data between sections
- [ ] Mocks reset in `beforeEach` with `jest.clearAllMocks()`
- [ ] No stale mock shapes (mock matches current hook return type)

All other conventions (TypeScript, architecture, style, test structure) are in `ai/skills/project-context/SKILL.md` § `Coding Conventions`.

## See Also

- `ai/commands/code-review/COMMAND.md` — the command that runs this checklist against a branch diff
