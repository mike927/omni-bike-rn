---
name: quality-review
description: Use this skill for code review, regression checks, test coverage, lint issues, and type-safety work in this repo.
---
# Quality Review

Use this skill when the task is about reviewing changes, checking for regressions, or improving tests and quality checks.

## Review Checklist

When reviewing code, check for:

- [ ] No `as any` — use real types
- [ ] `type` imports used for type-only values
- [ ] Errors caught as `unknown`, narrowed with `instanceof Error`
- [ ] Tagged logging with `[ClassName]` prefix
- [ ] Tests cover happy path and at least one error/edge case
- [ ] `__tests__/` colocated next to the source file
- [ ] No upward imports (parser importing from feature, service importing from hook)
- [ ] Adapter changes go through the contract interface, not concrete class
- [ ] New BLE characteristics use constants (not magic strings)
- [ ] `prefer-const` — no unnecessary `let`

## Common Issues

- **Stale mocks**: If a mock doesn't reset between tests, use `jest.clearAllMocks()` in `beforeEach`.
- **BLE base64 handling**: Two patterns exist — `atob`/`charCodeAt` (FTMS parser path) and `Buffer.from` (HR adapter). Keep them consistent within each adapter.
- **Signed integers**: FTMS fields like power and resistance are SINT16. Watch for incorrect unsigned reads.

## See Also

- `AGENTS.md` § Coding Conventions for test patterns, style rules, and validation commands.
