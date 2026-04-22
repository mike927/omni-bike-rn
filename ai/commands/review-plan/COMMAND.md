---
name: review-plan
description: >-
  Review the active branch's canonical implementation plan and persist a
  plan-quality report alongside it.
inputs: []
outputs:
  - name: review-file
    description: 'Findings written to ai/local/plans/<branch-slug>.review.md'
  - name: recommendation
    description: '"ready" when implementation can proceed safely, otherwise "revise"'
---

# Review Plan

Review the active feature branch's canonical plan file and record what is already strong, what must change, and what decisions are still missing before implementation continues. This command is the plan-quality gate for the `Plan Reviewing` stage in `AGENTS.md`.

## Prerequisites

- Current branch is a feature branch, not `main`.
- The canonical plan file exists at `ai/local/plans/<branch-slug>.md`.
- Invocation mode follows `AGENTS.md` `## Agent Roles`: direct review requests use specialist reviewer mode; workflow-owned reviews use workflow owner mode.

## Procedure

### Step 1: Verify The Active Branch And Plan File

```bash
git branch --show-current
```

- If the current branch is `main`, stop and report a blocker. `/review-plan` only reviews an active feature branch plan.
- Set:
  - `plan-file` = `ai/local/plans/<branch-slug>.md`
  - `review-file` = `ai/local/plans/<branch-slug>.review.md`

Confirm the canonical plan file exists:

```bash
test -f ai/local/plans/<branch-slug>.md
```

- If the file is missing, stop and report a blocker. Do not fall back to host-managed drafts or arbitrary paths.

### Step 2: Load Review Context

Read these sources before evaluating anything:

1. `ai/local/plans/<branch-slug>.md`
2. `plan.md`
3. `AGENTS.md`

Treat `AGENTS.md` and `plan.md` as the source of truth for workflow and scope alignment. The plan file itself is the artifact under review.

### Step 3: Identify The Relevant `plan.md` Task Context

Find the `plan.md` item or section this branch plan is supposed to implement.

Use this priority order:

1. An explicit branch reference in `plan.md`
2. A task title or summary in the branch plan that clearly matches a `plan.md` item
3. The current priority section if it unambiguously names the same work

If no relevant `plan.md` item can be identified:
- first check whether the branch plan explicitly records that this is ad-hoc or branch-local work that does not map to an existing `plan.md` item
- if it does, record that as valid scope context rather than a blocker
- if it does not, record the missing scope linkage under `## Must Change` and `## Missing Decisions`, then set the recommendation to `revise`

### Step 4: Evaluate The Plan

Review the plan against the drafting requirements in `ai/workflow/steps.md § 3. Plan Drafting` and the artifact conventions in `AGENTS.md § Workflow Artifacts`. Do not apply generic prose quality standards — only check alignment with repo rules.

Check each area against the relevant requirement:

1. **Branch alignment** — the plan matches the active branch purpose and does not describe unrelated work.
2. **Scope alignment** — covers the intended `plan.md` task, or explicitly records approved branch-local scope when no `plan.md` match exists. No drift, omissions, or scope creep.
3. **Decision completeness** — the implementer would not need to make product, workflow, or architecture decisions during implementation (per `ai/workflow/steps.md § 3. Plan Drafting`, which requires the plan to be specific enough to execute without further design decisions).
4. **Implementation sequencing** — steps and dependencies are ordered clearly enough to execute without re-planning.
5. **Validation and testing** — validation commands, manual checks, and acceptance scenarios are present and proportional to the change.
6. **Assumptions and tradeoffs** — important defaults, constraints, and out-of-scope choices are stated explicitly.
7. **Plan-file conventions** — `## What Will Be Available After Completion` exists and is the final section. Plan is at the canonical path. No conflict with `AGENTS.md` workflow or artifact rules.

Classify findings into these buckets:

- `## What Is Good` — strengths worth preserving
- `## Must Change` — blocking gaps, workflow conflicts, missing validation, missing scope linkage when branch-local scope is not explicitly recorded, or unclear handoff details
- `## Suggested Improvements` — non-blocking polish or clarity improvements
- `## Missing Decisions` — unresolved questions or assumptions the current plan leaves to the implementer

Recommendation rules:

- `ready` — no blocking issues; only optional improvements remain
- `revise` — any blocking issue exists in `## Must Change` or `## Missing Decisions`

### Step 5: Append A New Review Block

Append a fresh `## Review (<provider>, <ISO timestamp>)` block to the end of `ai/local/plans/<branch-slug>.review.md`. Every invocation appends; nothing in the file is overwritten. Prior review blocks, prior `/address-plan-review` resolution sections, and any other appended history stay intact.

Values:
- `<provider>` — the host name (e.g., `Claude`, `Codex`, `Gemini`).
- `<ISO timestamp>` — UTC ISO-8601, second precision (e.g., `2026-04-21T14:15:00Z`).

Block structure:

```md
## Review (<provider>, <ISO timestamp>)

Recommendation: <ready | revise>
Source Plan: ai/local/plans/<branch-slug>.md
Relevant plan.md item: <quoted task line | "branch-local work; no plan.md item required" | "none identified">

### What Is Good

- <strength>

### Must Change

- [ ] <blocking issue>

### Suggested Improvements

- [ ] <non-blocking improvement>

### Missing Decisions

- [ ] <decision still unresolved>

### Summary

<1-3 sentences stating whether implementation can proceed safely and why.>
```

File-level rules follow `ai/workflow/review-file.md § Review File State` (append-mode contract, latest-block-wins, never overwrite). If no prior file exists, create it with a single `# Plan Review: <branch-name>` H1 on line 1, then append the first block below it.

Block-content rules:

- Always list positives first.
- Keep required changes actionable and specific.
- Format all actionable items (Must Change, Suggested Improvements, Missing Decisions) as Markdown checklists (`- [ ] <issue>`) so they can be checked off during resolution.
- Do not rewrite the plan or edit the canonical plan file.
- If a sub-section has no items, write `- None.`

### Step 6: Report In Chat

Post a compact summary in chat:

```md
**Plan Review Complete**
Recommendation: <ready | revise>

- Strengths: <count>
- Must change: <count>
- Suggested improvements: <count>
- Missing decisions: <count>

Details: ai/local/plans/<branch-slug>.review.md
```

If the command stopped early because the branch was `main` or the canonical plan file was missing, report that blocker clearly and do not create a review file.

Close out per `AGENTS.md` § `Agent Roles` — workflow owner mode flows into the next step from the enclosing workflow stage; specialist reviewer mode stops here.

## Completion Criteria

- The active branch and canonical plan path were validated.
- The plan was reviewed against `plan.md` and `AGENTS.md`.
- Findings were written to `ai/local/plans/<branch-slug>.review.md` using the required structure.
- A chat summary reported whether implementation is `ready` or must `revise`.

## See Also

- `ai/commands/check-state/COMMAND.md` — bootstrap or resume branch context
- `ai/commands/address-plan-review/COMMAND.md` — triage plan-review findings and update the plan intentionally
- `ai/commands/code-review/COMMAND.md` — review implementation quality after code exists
