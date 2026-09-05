# A02 — Persistence failure silently leaves a ride unsaved

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Done |
| Owner | automated remediation agent |
| Branch / PR | `fix/a02-persistence-failure-recovery` |
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

- [x] Inject draft, sample, and finalization errors independently and assert visible recovery state.
- [x] Assert a failed finalization cannot produce successful navigation/reset.
- [x] Retry with stable session identity; verify no duplicate drafts/samples and document bounded handling of failed sample writes.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05 - Claimed by the automated remediation agent on `fix/a02-persistence-failure-recovery`; revalidated the finding against `cd1bbb7` (post A01/A06).
- 2026-09-05 - Reproduced both failure modes in Jest, then made the durable persistence outcome part of the session lifecycle. Acceptance met by unit tests; `npm run ci:gate` green. PR opened; status Done pending coordinator review and merge.

## Completion / disposition record

**Change summary.** The durable outcome of writing a ride is now part of the session lifecycle instead of a
fire-and-forget side effect.

- `src/store/sessionPersistenceStore.ts` (new): the ride's storage state (`idle` / `recording` / `atRisk` /
  `saved` / `unsaved`), its stable session id, a dropped-sample counter and the last error. Reports are keyed
  by session id, so a late write from an abandoned ride cannot flag the current one.
- `useTrainingSessionPersistence`: a failed draft no longer clears the ride's identity, it marks the ride
  `atRisk` and keeps recording in memory; the Finished transition writes the ride durably (creating the row
  first when the draft never landed) and reports `saved` or `unsaved`; a failed sample write is counted and
  abandoned, never buffered. New awaitable seams: `awaitSessionSave`, `retrySessionSave`,
  `discardUnsavedSessionRecord`. The write queue moved to module scope so the lifecycle can await it.
- `sessionController`: `finishSessionAndDisconnect` now returns `FinishSessionOutcome`
  (`completed` + session id, or `unsaved` + message) and only tears the ride down after the save is known to
  have succeeded. Added `retryFinishSave` (same identity, no duplicate rows) and `discardUnsavedSession`
  (the only other way out of the unsaved state). Also fixed the two defects deferred here from A01: the
  teardown is now latched so overlapping callers run it once (`disconnectPauseSuppressed` can no longer be
  cleared early), and `restoreSession` self-guards on Idle like its siblings.
- UI: `RideStorageNotice` + the pure `deriveStorageNotice` surface the state on the Training dashboard
  (warnings while riding, a `Ride not saved` callout with Retry Save / Discard Ride when a finished ride is
  not on disk, which replaces the bottom control bar). A failed Finish no longer navigates, from the screen
  or from the wrist: `useWatchRideRemote` routes an unsaved ride to the ride screen instead of a summary.
- Docs: `AGENTS.md` gains a **Ride persistence outcome** domain rule; `DESIGN.md` documents the notice.

**Branch / PR.** `fix/a02-persistence-failure-recovery`, PR (link added below on creation)

**Executed commands.**

- `npx jest src/features/training/hooks/__tests__/sessionPersistenceRecovery.test.ts` before implementing:
  7 failed / 7 (red baseline). `npx jest src/features/training/__tests__/sessionController.test.ts`
  before implementing: 2 new tests failed (teardown latch, restore guard).
- `npm run ci:gate` (lint + typecheck + `jest --ci --runInBand`): green, exit 0, 110 suites / 1054 tests.
- Mutation checks, each one reverting a single part of the fix and rerunning the suites: removing the
  last-chance write at Finish (1 failure), restoring the draft-failure identity clear (2), dropping the
  sample-failure accounting (1), making the controller ignore the save outcome (4), letting the screen
  navigate on an unsaved finish (1), removing the teardown latch and restore guard (2). Every part of the
  fix is bound by at least one test.

**Bounded handling of failed sample writes.** A sample whose write fails is counted in
`droppedSampleCount` and abandoned. It is never retried and never buffered, so a broken disk cannot grow
app memory during a ride; the session row's totals are rewritten in full when the ride is finalized, so a
dropped second costs ride detail, not the ride.

**Remaining limitations.**

- No physical-device evidence: injecting a SQLite write failure on device needs a build with fault
  injection, and the ticket's criteria do not require it. The behaviour is covered by unit tests at the
  lifecycle and screen level.
- A ride whose draft never reached storage is only written at Finish, so its per-second samples are lost
  and the app cannot recover it if the process dies mid-ride. Sample-level durability under a failed draft
  would need buffering, which this ticket deliberately rejects.
- Home's `deriveRideHero` still treats `Finished` as transient, so during an unsaved window Home shows
  `Start Ride`. Pressing it lands on the ride screen with the recovery callout, so nothing is lost, but a
  dedicated Home state would be clearer. Left out of scope; noted as a follow-up.
