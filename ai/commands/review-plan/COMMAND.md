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
- Derive `branch-slug` by replacing `/` with `-`.
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

Review the plan against the requirements in `AGENTS.md` `Plan Reviewing` stage and the artifact conventions in `AGENTS.md` § Workflow Artifacts. Do not apply generic prose quality standards — only check alignment with repo rules.

Check each area against the relevant `AGENTS.md` requirement:

1. **Branch alignment** — the plan matches the active branch purpose and does not describe unrelated work.
2. **Scope alignment** — covers the intended `plan.md` task, or explicitly records approved branch-local scope when there is no `plan.md` match; no drift, omissions, or scope creep.
3. **Decision completeness** — the implementer would not need to make product, workflow, or architecture decisions during implementation (per the `AGENTS.md` `Plan Drafting` stage requirement that the plan "must be specific enough to execute without further design decisions").
4. **Implementation sequencing** — steps and dependencies are ordered clearly enough to execute without re-planning.
5. **Validation and testing** — validation commands, manual checks, and acceptance scenarios are present and proportional to the change (per the `AGENTS.md` implementation-through-manual-testing stages).
6. **Assumptions and tradeoffs** — important defaults, constraints, and out-of-scope choices are stated explicitly.
7. **Plan-file conventions** — `## What Will Be Available After Completion` exists and is the final section; plan is at the canonical path; no conflict with `AGENTS.md` workflow or artifact rules.

Classify findings into these buckets:

- `## What Is Good` — strengths worth preserving
- `## Must Change` — blocking gaps, workflow conflicts, missing validation, missing scope linkage when branch-local scope is not explicitly recorded, or unclear handoff details
- `## Suggested Improvements` — non-blocking polish or clarity improvements
- `## Missing Decisions` — unresolved questions or assumptions the current plan leaves to the implementer

Recommendation rules:

- `ready` — no blocking issues; only optional improvements remain
- `revise` — any blocking issue exists in `## Must Change` or `## Missing Decisions`

### Step 5: Write Or Refresh The Review File

Write the current assessment to `ai/local/plans/<branch-slug>.review.md`, but preserve any appended resolution history created by `/address-plan-review`.

Refresh only these review-owned sections:

- title and metadata
- `## What Is Good`
- `## Must Change`
- `## Suggested Improvements`
- `## Missing Decisions`
- `## Summary`

If the file already contains appended history sections such as:

- `## Addressed Items`
- `## Declined Items`
- `## Needs User Input`
- `## Already Resolved`
- `## Resolution Summary`

keep them intact and leave them after the refreshed top review block. Do not delete prior decision history on reruns.

Use this exact structure:

```md
# Plan Review: <branch-name>

Date: <YYYY-MM-DD>
Source Plan: ai/local/plans/<branch-slug>.md
Recommendation: <ready | revise>
Relevant plan.md item: <quoted task line | "branch-local work; no plan.md item required" | "none identified">

## What Is Good

- <strength>

## Must Change

- [ ] <blocking issue>

## Suggested Improvements

- [ ] <non-blocking improvement>

## Missing Decisions

- [ ] <decision still unresolved>

## Summary

<1-3 sentences stating whether implementation can proceed safely and why.>
```

Rules:

- Always list positives first.
- Keep required changes actionable and specific.
- Format all actionable items (Must Change, Suggested Improvements, Missing Decisions) as Markdown checklists (`- [ ] <issue>`) so they can be checked off during resolution.
- Do not rewrite the plan or edit the canonical plan file.
- If a section has no items, write `- None.`
- If no prior review file exists, create it from scratch using the structure above.
- If prior resolution history exists, preserve it verbatim below the refreshed review block.

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

When running in **workflow owner** mode:
- if the recommendation is `ready`, append:
  > Plan quality gate passed. Proceed to `Plan Approving` — share the plan with the human for approval.
- if the recommendation is `revise`, append:
  > Run `/address-plan-review` to resolve the blocking findings, then re-run `/review-plan`.

When running in **specialist reviewer** mode:
- stop after the summary and review file path
- do not suggest the next workflow step
- do not ask `Proceed to Step <N>?`

## Output Format

- Persistent artifact: `ai/local/plans/<branch-slug>.review.md`
- Chat summary: recommendation plus item counts and the review file path; append workflow handoff text only in workflow owner mode

## Completion Criteria

- The active branch and canonical plan path were validated.
- The plan was reviewed against `plan.md` and `AGENTS.md`.
- Findings were written to `ai/local/plans/<branch-slug>.review.md` using the required structure.
- A chat summary reported whether implementation is `ready` or must `revise`.

## See Also

- `ai/commands/check-state/COMMAND.md` — bootstrap or resume branch context
- `ai/commands/address-plan-review/COMMAND.md` — triage plan-review findings and update the plan intentionally
- `ai/commands/code-review/COMMAND.md` — review implementation quality after code exists
