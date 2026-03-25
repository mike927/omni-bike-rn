---
name: quality-review
description: Use this skill for PR reviews, code quality checks, regression analysis, and test coverage work in this repo.
---
# Quality Review

Use this skill when reviewing a pull request or checking for regressions.

## PR Review Workflow

1. Fetch PR metadata: `gh pr view --json number,title,body,url,baseRefName,headRefName`
2. Fetch the diff: `gh pr diff`
3. Check CI status: `gh pr checks`
4. Cross-reference changed plan items in `plan.md` to confirm scope alignment
5. Apply the checklist below
6. Write the full review output to `ai/reviews/pr-<number>.md` (create the file if it doesn't exist)
7. Report findings with `file:line` references and give an overall merge recommendation in that file
8. If all review points in `ai/reviews/pr-<number>.md` are either addressed in code or explicitly acknowledged and intentionally skipped, remove that review file before finishing the review loop so `ai/reviews/` only contains open review work.

## Review Checklist

- [ ] Logic matches the plan item — no scope creep, no missing behaviour
- [ ] Edge cases handled (null, empty, disconnected state)
- [ ] No unnecessary duplication of UI or data between sections
- [ ] Mocks reset in `beforeEach` with `jest.clearAllMocks()`
- [ ] No stale mock shapes (mock matches current hook return type)

All other conventions (TypeScript, architecture, style, test structure) are in `AGENTS.md` § Coding Conventions.
