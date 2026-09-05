# A06 — Bike Started events override manual pause

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | In progress |
| Owner | automated remediation agent |
| Branch / PR | fix/a06-manual-pause-precedence |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | consistency |
| Severity | Medium |
| Priority | P1 — Next |
| Evidence | Confirmed — controlled React reproduction |
| Estimated effort | Small |

## Dependencies and coordination

Resolve A01 first so multiple lifecycle owners cannot obscure pause behavior.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/features/training/hooks/useTrainingSession.ts](<../../../../src/features/training/hooks/useTrainingSession.ts>) — audit lines/section 111–134, 209–239.
- [ROADMAP.md](<../../../../ROADMAP.md>) — audit lines/section Product Flow Notes.
- [src/types/training.ts](<../../../../src/types/training.ts>) — audit lines/section TrainingPhase and VALID_TRANSITIONS.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

The bike-status handler resumes every Paused session without retaining the reason it paused. This violates the explicit manual-pause precedence rule.

## Triggering scenario

Pause manually, receive the bike Paused status, then receive Started as pedaling resumes. Watch remote pause must follow the same ownership semantics.

## Expected versus observed / evidence

The audit React harness confirmed the session becomes Active. Expected: manual pause persists until an explicit Resume; eligible automatic pauses may resume from bike events.



## Impact and triage

Medium/P1: a routine sequence unexpectedly restarts recording. Pausing again is a temporary workaround but can be overridden again.

## Smallest sound correction or improvement

Track pause ownership/reason in shared lifecycle state. Permit automatic resume only for eligible bike-driven pauses. Explicit Resume clears manual pause; define restored-session behavior deliberately.

## Acceptance criteria and verification

- [ ] Manual pause followed by bike Started remains Paused.
- [ ] An eligible bike-driven pause resumes correctly; explicit Resume clears the manual reason.
- [ ] Cover interrupted-session restore and Watch remote pause through the same actions.
- [ ] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [ ] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05 — Claimed by automated remediation agent on branch `fix/a06-manual-pause-precedence`. A01 already merged (`7081c13`); the seam is `syncSessionFromBikeStatus` in `src/features/training/sessionController.ts`, which now holds single-owner session lifecycle logic.

## Completion / disposition record

No implementation, PR or new verification recorded yet. Before closing, replace this paragraph with:

- Change summary and commit/PR (or evidence-backed reason for deferral/rejection).
- Executed commands with outcomes and relevant regression evidence.
- Physical-device results where required, including build revision and log references.
- Remaining limitations or follow-up issue links.
