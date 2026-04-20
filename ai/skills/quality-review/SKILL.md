---
name: quality-review
description: Review checklist and quality standards for code reviews, regression analysis, and test coverage.
---
# Quality Review

Use this skill for the review checklist and quality standards applied during code reviews.

## Review Checklist

- [ ] Logic matches the plan item — no scope creep, no missing behaviour
- [ ] Edge cases handled (null, empty, disconnected state)
- [ ] No unnecessary duplication of UI or data between sections
- [ ] Mocks reset in `beforeEach` with `jest.clearAllMocks()`
- [ ] No stale mock shapes (mock matches current hook return type)

All other conventions (TypeScript, architecture, style, test structure) are in `AGENTS.md` § `Coding Conventions`.
