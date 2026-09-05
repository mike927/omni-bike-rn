# A02 — Persistence failure silently leaves a ride unsaved

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Branch / PR | None |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | correctness |
| Severity | High |
| Priority | P1 — Next |
| Evidence | Confirmed — injected persistence failure reproduction |
| Estimated effort | Medium |

## Dependencies and coordination

Coordinate with A01; persistence acknowledgement must belong to the shared session lifecycle.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/features/training/hooks/useTrainingSessionPersistence.ts](<../../../../src/features/training/hooks/useTrainingSessionPersistence.ts>) — audit lines/section 111–165, 238–252.
- [src/features/training/hooks/useTrainingSession.ts](<../../../../src/features/training/hooks/useTrainingSession.ts>) — audit lines/section 151–194.
- [src/features/training/screens/TrainingDashboardScreen.tsx](<../../../../src/features/training/screens/TrainingDashboardScreen.tsx>) — audit lines/section 108–122.
- [src/features/training/hooks/__tests__/useTrainingSessionPersistence.test.ts](<../../../../src/features/training/hooks/__tests__/useTrainingSessionPersistence.test.ts>) — audit lines/section 241–263.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Draft creation failure clears the active session ID and logs the error, while recording continues. Later samples are skipped. Finish resets memory and returns Home when the ID is null. Finalization errors are also swallowed rather than becoming a failed Finish operation.

## Triggering scenario

Make `createDraftSession` fail, for example with SQLite disk full; continue riding and press Finish. Separately exercise a failure during finalization.

## Expected versus observed / evidence

Injected-failure reproduction: after draft failure, `phase=active`, `sessionId=null`, one timer; after Finish, `phase=idle`, returned ID null, zero timers. Expected: visible failure and a recoverable lifecycle, without pretending recording/save succeeded. The existing failure test merely verifies that samples are not appended.



## Impact and triage

High/P1: the affected ride can be irrecoverably lost. Storage failures may be uncommon, but continuing without a persisted identity leaves no normal recovery path.

## Smallest sound correction or improvement

Confirm durable draft creation before normal recording begins. Expose persistence failures and an awaitable finalization outcome. Retain recoverable state until finalization succeeds or the user explicitly discards it. Avoid unbounded sample buffering, and retain stable identity across retries.

## Acceptance criteria and verification

- [ ] Inject draft, sample, and finalization errors independently and assert visible recovery state.
- [ ] Assert a failed finalization cannot produce successful navigation/reset.
- [ ] Retry with stable session identity; verify no duplicate drafts/samples and document bounded handling of failed sample writes.
- [ ] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [ ] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.

## Completion / disposition record

No implementation, PR or new verification recorded yet. Before closing, replace this paragraph with:

- Change summary and commit/PR (or evidence-backed reason for deferral/rejection).
- Executed commands with outcomes and relevant regression evidence.
- Physical-device results where required, including build revision and log references.
- Remaining limitations or follow-up issue links.
