# A03 — Interrupted uploads remain permanently uploading

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | In progress |
| Owner | automated remediation agent |
| Branch / PR | `fix/a03-interrupted-upload-recovery` / https://github.com/mike927/omni-bike-rn/pull/113 |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | correctness |
| Severity | High |
| Priority | P1 — Next |
| Evidence | Confirmed — static persisted-state trace |
| Estimated effort | Medium |

## Dependencies and coordination

Independent of session recording fixes. Provider-specific recovery stays behind ExportProvider.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/services/db/providerUploadRepository.ts](<../../../../src/services/db/providerUploadRepository.ts>) — audit lines/section 135–157.
- [src/services/export/uploadOrchestrator.ts](<../../../../src/services/export/uploadOrchestrator.ts>) — audit lines/section 67–117.
- [src/bootstrap/useAppInitialization.ts](<../../../../src/bootstrap/useAppInitialization.ts>) — audit lines/section 29–117.
- [src/services/export/StravaExportProvider.ts](<../../../../src/services/export/StravaExportProvider.ts>) — audit lines/section 35–82.
- [src/services/export/AppleHealthExportProvider.ts](<../../../../src/services/export/AppleHealthExportProvider.ts>) — audit lines/section 20–34.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

The upload claim persists `uploading` before awaiting the provider. Only ready/failed rows can be claimed. Neither startup nor retry reconciles abandoned uploading rows.

## Triggering scenario

Terminate the process after a durable upload claim but before the final local status update, then relaunch and retry that workout/provider pair.

## Expected versus observed / evidence

The persisted row remains uploading and the orchestrator returns “Upload already in progress.” No current-process operation exists. Expected: a recoverable abandoned operation, including the possibility that remote submission already succeeded.



## Impact and triage

High/P1: individual interrupted uploads remain blocked across launches, and normal retry offers no recovery. Local workout data remains intact.

## Smallest sound correction or improvement

Distinguish live operations from abandoned persisted attempts. Add provider-aware reconciliation and retain remote operation/activity identity when available. Do not blindly reset and resend: the provider may already have accepted the workout. Keep provider-specific details behind the existing adapter contract.

## Acceptance criteria and verification

- [ ] Restart against the same database after interruption before submission, during processing, and after remote success before local acknowledgement. **Not provable in Jest**: needs a real process kill against a real SQLite file. The three state-machine equivalents are covered in `src/services/export/__tests__/uploadInterruptionRecovery.test.ts`, and the boot sweep is covered in `src/bootstrap/__tests__/useAppInitialization.test.ts`, but a physical relaunch is outstanding.
- [ ] Ensure each case converges to a recoverable or uploaded state without duplicate remote export. **Partially proven**: convergence to `interrupted` then to `uploaded` (resend or acknowledgement) is unit-tested, including that no second `exportSession` runs. "No duplicate on the provider" itself needs a real Strava round trip and is outstanding.
- [x] Retain concurrent-request exclusion while allowing abandoned attempts to recover.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: claimed by the automated remediation agent on `fix/a03-interrupted-upload-recovery` (branched off `0d0270b`, post A01/A02/A06). Reproduced the finding as a failing test first, then made `uploading` mean "live in this process", added the `interrupted` state, a boot-time sweep of abandoned rows, and a user-settled resolution (resend or acknowledge) that never guesses whether the provider already has the ride. Status stays In progress: the restart and no-duplicate criteria need a physical relaunch and a real provider round trip.

- 2026-09-05: independent review returned APPROVED with SPEC MET plus two Important findings and
  several minors. Fix round 1 on the same branch: a resend that fails now stays `interrupted` instead
  of collapsing to `failed` (so the next send still warns), the Apple Health interruption branch is
  covered by tests, `describeUpload` lost its unreachable `interrupted` branch, the acknowledge
  idempotency fallback and both prompt corner cases are tested and surfaced, the boot sweep runs once
  per launch, and the interruption copy is asserted against the real function. Status stays
  In progress: the device-only criteria are unchanged.

- 2026-09-05: scoped re-review returned ALL_ADDRESSED with no new breakage, and also corrected round
  1's finding 6: the boot-sweep once-guard is provable in Jest after all, via a retry that fails after
  an earlier retry already succeeded. Fix round 2 on the same branch: the StrictMode sweep test that
  proved nothing was replaced with a test driving that exact retry cycle, and a failed resend's stored
  error is now appended to the interrupted-row caption (it used to show once in a transient alert and
  then vanish). Neither item was an open finding; both sit in code the last round added. Status stays
  In progress: the device-only criteria are unchanged.

## Completion / disposition record

**Change summary.** The upload state machine now distinguishes a live operation from an abandoned
persisted attempt, and represents the resulting uncertainty instead of resolving it by guessing.

- `SessionUploadState` gains `interrupted`. No schema migration: `upload_state` is a plain `TEXT`
  column with no check constraint.
- `src/services/export/uploadOrchestrator.ts` keeps a set of the uploads live in the current process.
  A persisted `uploading` row whose key is not in that set was abandoned by a killed process, so it is
  reclassified as `interrupted` instead of reporting "Upload already in progress." forever. A live row
  still reports it, so concurrent-request exclusion is unchanged.
- `interrupted` is never resent and never failed by the app. `uploadSessionToProvider` returns
  `needsInterruptionDecision`, and only `resendInterruptedUpload` (user accepted a possible duplicate)
  or `acknowledgeInterruptedUpload` (user confirmed the ride is already on the provider) can leave that
  state.
- `src/services/db/providerUploadRepository.ts` gains atomic, state-guarded transitions
  (`markProviderUploadInterrupted`, `claimInterruptedProviderUpload`,
  `markInterruptedProviderUploadAcknowledged`) and a boot sweep
  (`markAbandonedProviderUploadsInterrupted`). Reclassifying keeps the recorded remote id, which is the
  only handle on what the provider may already hold.
- `src/bootstrap/useAppInitialization.ts` runs that sweep once the database is ready. No upload can be
  live before the app starts one, so every `uploading` row at boot is abandoned by definition. The
  sweep is local only: no provider is contacted, because whether it accepted the ride is exactly what
  is unknown.
- `src/features/training/screens/TrainingSummaryScreen.tsx` renders the state (`Check <Provider>` plus
  a caption) and offers the decision (`Not Now` / `Already There` / `Upload Again`).

The `ExportProvider` seam is untouched: no provider error string reaches the orchestrator, and the
provider-agnostic `GearReconcileOutcome` path is unchanged.

**Executed commands.**

- `npx jest src/services/export/__tests__/uploadInterruptionRecovery.test.ts` before the fix:
  5 failed / 8 (the 3 passing ones are regression guards that hold on both sides).
- `npx jest src/bootstrap` before the boot sweep: 1 failed / 10.
- `npx jest src/features/training/screens/__tests__/TrainingSummaryScreen.test.tsx` before the screen
  change: 4 failed / 19.
- `npm run ci:gate` after the fix: exit 0. Lint clean, `tsc --noEmit` clean, 112 suites / 1091 tests
  passed.
- Mutation check (fix reverted one piece at a time, targeted suites rerun): every piece is bound by at
  least one failing test. Removing the abandoned-attempt detection fails 4 tests; removing the live
  registry fails 1; removing the boot sweep fails 1; auto-resending an interrupted row fails 4;
  never releasing the live key fails 3; dropping the screen's decision branch fails 3; widening the
  repository's `uploading` guard fails 1.

**Review fix round 1 (2026-09-05).** Applied on the same branch after the independent review:

- A resend the user asked for that fails now returns to `interrupted`, not `failed`
  (`runClaimedUpload` takes the failure state from its caller). A failed resend says nothing about
  whether the earlier attempt reached the provider, and a `failed` row is claimable by a plain retry
  that would warn nobody, which was the one remaining way to duplicate an activity silently.
- The Apple Health interruption branch on the summary screen is now covered by tests (state, prompt,
  resend), so it is no longer an untested hand-copy of the Strava branch.
- `describeUpload` lost its unreachable `interrupted` branch, and its already-uploaded result now
  says nothing was sent (`alreadyUploaded`), which the screen reports as `Already Uploaded` instead
  of announcing an upload that never ran.
- The acknowledge idempotency fallback is tested, and a losing `Already There` now reports
  `Upload Not Updated` instead of doing nothing visible.
- The boot sweep carries the same once-per-launch guard as `useInterruptedSessionRecovery`.
- The `markProviderUploadInterrupted` comment no longer claims a surviving remote id: the column is
  reserved, and an `uploading` row's `external_id` is always null today.
- The interruption notice is asserted verbatim against the real orchestrator function, not only via
  a screen-level mock.

Commands: `npm run ci:gate` exit 0 (lint clean, `tsc --noEmit` clean, 112 suites / 1102 tests), plus
a fresh mutation pass over the eight changed behaviours (6 caught, 1 shown unreachable by a throw
probe, 1 recorded as not observable in Jest: the boot sweep once-guard, because nothing can flip
`isDatabaseReady` back to true within one launch).

**Review fix round 2 (2026-09-05).** A scoped re-review of the round 1 diff verdicted ALL_ADDRESSED
with no new breakage, and corrected the round 1 record above: `retry` is part of the returned
`AppInitState` and is not single-use, so a retry that fails after an earlier retry already succeeded
does flip `isDatabaseReady` `true -> false -> true` within one launch, re-entering the sweep effect a
second time. That made the round 1 StrictMode test's "not observable" premise wrong, and the two
fixes below, applied on the same branch, target code the round 1 diff added:

- The StrictMode sweep test passed with the once-guard removed, so it proved nothing about the guard.
  Replaced with a test that drives the actual seam: reject, retry, resolve, retry, reject, retry,
  resolve. With the guard: 1 sweep. With the guard removed: 2 sweeps, and the new test fails.
- A failed resend's error text was being stored on the `interrupted` row (round 1's fix), but the
  screen's caption checked `interrupted` before `failed` and never read it back, so the reason showed
  once in the transient `Upload Failed` alert and then never again. `uploadNotice` now appends the
  stored reason inside the `interrupted` branch, keeping the interruption framing ("the retry failed",
  a fact about our own attempt, never about what the provider holds): the row still reads
  `Check <Provider>`, never `Retry <Provider>`.

Commands: `npm run ci:gate` exit 0 (lint clean, `tsc --noEmit` clean, 112 suites / 1103 tests), plus
both mutations run directly against the source and reverted: the guard removal drops the sweep-count
assertion from 1 to 2 (new test fails), and reverting the appended-reason line makes the new screen
test fail to find the caption. Full detail, exact commands and output in
`.superpowers/sdd/audit-2026-09-05/reports/A03-report.md` ("A03 fix round 2").

**Pull request.** https://github.com/mike927/omni-bike-rn/pull/113

**Physical-device results.** None. See the limitations below.

**Remaining limitations.**

- No physical relaunch evidence. Killing the app mid-upload and relaunching against the same SQLite
  file is the only way to prove the persisted-state half end to end; Jest covers the state machine and
  the boot sweep, not a real process death.
- No real provider round trip. "No duplicate remote export" is proven only as "no second
  `exportSession` call".
- No automatic safe check. Neither provider can currently answer "do you already have this ride?"
  without new work: Strava would need a durable remote-operation id or an activity lookup, Apple Health
  would need a new native HealthKit query. The uncertainty is therefore always settled by the user. A
  provider-agnostic lookup added later slots in at the one place `interruptionDecision` is returned,
  and would keep provider specifics behind `ExportProvider`.
- The aggregate roadmap item stays `[~]`, which is already its state while audit remediation is active.
