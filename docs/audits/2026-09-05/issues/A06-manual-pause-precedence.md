# A06 — Bike Started events override manual pause

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Done |
| Owner | automated remediation agent |
| Branch / PR | fix/a06-manual-pause-precedence · https://github.com/mike927/omni-bike-rn/pull/109 |
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

- [x] Manual pause followed by bike Started remains Paused.
- [x] An eligible bike-driven pause resumes correctly; explicit Resume clears the manual reason.
- [x] Cover interrupted-session restore and Watch remote pause through the same actions.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: Claimed by automated remediation agent on branch `fix/a06-manual-pause-precedence`. A01 already merged (`7081c13`); the seam is `syncSessionFromBikeStatus` in `src/features/training/sessionController.ts`, which now holds single-owner session lifecycle logic.
- 2026-09-05: Wrote failing tests first (TDD): `src/features/training/__tests__/sessionController.test.ts` (new) and one added case in `src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts`. Confirmed both failed against the unfixed code, then implemented the fix, confirmed green, and confirmed by mutation (see below). PR opened: https://github.com/mike927/omni-bike-rn/pull/109.
- 2026-09-05: cross-link. The device-only checks this ticket leaves outstanding are folded into the consolidated device pass at [`docs/audits/2026-09-05/device-verification.md`](../device-verification.md), produced under [A11](A11-native-upgrade-verification.md) and run once against build `c19673e` for all of A01 to A10. Nothing here changes until that run is recorded.

## Completion / disposition record

**Change summary.** `syncSessionFromBikeStatus` resumed every Paused session on a bike `Started` event with no memory of why it paused, so a manual Pause (screen or Watch remote, both via `pauseSession`) was silently overridden the moment pedaling resumed. Fix: a module-scoped `manualPauseActive` flag in `src/features/training/sessionController.ts`, set by `pauseSession()`, cleared only by an explicit `resumeSession()`. `syncSessionFromBikeStatus` now auto-resumes from Paused only when the flag is clear, so a bike-driven pause (via `freezeActiveSession`, which never sets the flag) remains eligible for bike-driven auto-resume while a manual pause is not. Added `restoreSession()` as the sessionController-owned command for restoring an interrupted session; it marks the same manual-pause intent (the user chose to bring the ride back, so a bike Started event must not resume it before an explicit Resume). `useInterruptedSession.ts` now calls `restoreSession()` instead of writing to the store directly, keeping the restore path inside the single lifecycle owner. The flag is scoped to one ride: both places a ride starts fresh from Idle (`startSession`, and the Idle branch of `syncSessionFromBikeStatus`) clear it first, so a manual pause can never leak into the next ride. No changes to `advanceSession`, `VALID_TRANSITIONS`, or any screen-owned lifecycle effect; `resetSessionAndConnections` was left untouched (see limitation below).

**PR.** https://github.com/mike927/omni-bike-rn/pull/109 (branch `fix/a06-manual-pause-precedence`).

**Commands run and outcomes.**
- `npx jest src/features/training`: 14 suites / 134 tests passed.
- `npm run test:changed` (`jest --changedSince=main`): 7 suites / 92 tests passed.
- `npm run ci:gate` (lint + typecheck + full `jest --ci --runInBand`): clean lint, clean typecheck, 109 suites / 1034 tests passed.
- Mutation check (manual, not an automated mutation-testing tool): reverted each of the three behavioral edits one at a time (the `!manualPauseActive` guard in `syncSessionFromBikeStatus`, the `manualPauseActive = false` line in `resumeSession()`, and the `manualPauseActive = true` line in `restoreSession()`) and reran the new tests after each revert. Each reversion reproduced a test failure (the manual-pause, restore, explicit-resume-clears-reason, and Watch-remote tests each caught a distinct mutation), then the fix was restored and the full suite reconfirmed green. This is the "delete the fix, watch the test fail" check the coordinator required; it was not a formal mutation-testing tool run.

**Regression evidence.** New coverage: `src/features/training/__tests__/sessionController.test.ts` (manual pause survives bike Started; an eligible bike-driven pause still auto-resumes; explicit Resume clears the manual reason so a later bike-driven pause can auto-resume again; a restored interrupted session requires explicit Resume before a bike Started event can resume it) and one added case in `src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts` (an on-wrist Pause survives a bike Started event, then resumes on an on-wrist Resume) covering the Watch remote through the real lifecycle hook and the mocked WatchConnectivity bridge.

**Physical-device verification.** Not performed; not required for this fix, which is pure JS/TS state-machine logic with no native surface. The Watch-remote path is covered here through the existing mocked-bridge integration test, consistent with how `trainingSessionOwnership.test.ts` already tests on-wrist Pause/Resume elsewhere in that suite.

**Remaining limitations / follow-ups.**
- `resetSessionAndConnections` (`src/features/training/sessionController.ts`) still has no re-entrancy latch for `disconnectPauseSuppressed`, as previously identified and deferred to A02. This fix deliberately does not touch that function (the new `manualPauseActive` flag is cleared only at the two "fresh ride from Idle" entry points, `startSession` and the Idle branch of `syncSessionFromBikeStatus`, not in teardown), so it neither fixes nor worsens that known issue.
- No UI surfaces the pause reason to the user (e.g. "paused by you" vs "paused by bike"); the ticket only required correct precedence, not a UI affordance, so this was not added.
