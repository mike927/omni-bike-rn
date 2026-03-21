---
name: quality-review
description: Use this skill for code review, regression checks, test coverage, lint issues, and type-safety work in this repo.
---
# Quality Review

Use this skill when the task is about reviewing changes, checking for regressions, or improving tests and quality checks.

## Validation Commands

```bash
npm run lint          # ESLint + Prettier
npm run typecheck     # tsc --noEmit
npm test -- --ci --runInBand   # Jest
npm run ci:gate       # All of the above
npm run build:smoke   # Production build check
```

## Test Patterns

- **Framework**: Jest
- **Location**: `__tests__/` directories colocated with the source (e.g., `src/services/ble/__tests__/`)
- **Naming**: `<Module>.test.ts`
- **Mocking**: Mock external dependencies at the module level using `jest.mock()`. Example: `jest.mock('../bleClient', ...)`
- **Structure**: `describe` blocks per method or behavior, `it` for individual cases
- **Assertions**: Use `expect(...).toHaveBeenCalledWith()` for mock verification, `expect.objectContaining()` for partial matches

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
