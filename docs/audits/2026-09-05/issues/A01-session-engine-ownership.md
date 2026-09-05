# A01 — Screen-owned engines stop or double session recording

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Done |
| Owner | automated remediation agent |
| Branch / PR | `fix/a01-session-engine-ownership` / https://github.com/mike927/omni-bike-rn/pull/108 |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | architecture |
| Severity | High |
| Priority | P1 — Next |
| Evidence | Confirmed — controlled React reproduction |
| Estimated effort | Medium |

## Dependencies and coordination

None. Resolve before A06; coordinate lifecycle ownership with A02.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/features/training/hooks/useTrainingSession.ts](<../../../../src/features/training/hooks/useTrainingSession.ts>) — audit lines/section 39–62, 209–239, 271–275.
- [src/features/home/screens/HomeScreen.tsx](<../../../../src/features/home/screens/HomeScreen.tsx>) — audit lines/section 30.
- [src/features/training/screens/TrainingDashboardScreen.tsx](<../../../../src/features/training/screens/TrainingDashboardScreen.tsx>) — audit lines/section 36, 136–143.
- [src/features/training/hooks/__tests__/useTrainingSession.test.ts](<../../../../src/features/training/hooks/__tests__/useTrainingSession.test.ts>) — audit lines/section 16–28.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Each `useTrainingSession()` instance owns a separate `MetronomeEngine`, although all instances manipulate the same global session. Home and Training both mount this effectful hook.

## Triggering scenario

1. Start from Training, then tap Back and reopen Training.
2. Separately, let a bike Started event start recording on Home, open Training, then Pause/Resume.

## Expected versus observed / evidence

The audit used the installed React renderer and real hook, store, and engine with controlled timers/device dependencies. Sequence 1 left `phase=active` with zero timers, including after reopening Training. Sequence 2 left two timers; one simulated second advanced `elapsedSeconds` by two. Expected: exactly one recording clock throughout an active ride.

React Navigation keeps the underlying screen mounted when pushing and unmounts the pushed screen on Back: [official lifecycle documentation](https://reactnavigation.org/docs/navigation-lifecycle/).

## Impact and triage

High/P1: supported navigation and controls can lose samples or inflate elapsed time and formula-derived totals. Staying on one screen avoids only some paths.

## Smallest sound correction or improvement

Give the session lifecycle one root-owned engine and bike-status observer. Expose state and commands through consumer hooks; preserve `advanceSession`. Making only the engine a singleton leaves competing cleanup owners. Use the existing bootstrap lifecycle seam rather than adding a parallel application framework.

## Acceptance criteria and verification

- [x] Mount Home and Training consumers together with real engine behavior; exercise both start origins.
- [x] Assert one tick per second while Active and zero while Paused, including Back/reentry and repeated Pause/Resume.
- [x] Assert finish/reset leaves no timer and a stale consumer cleanup cannot stop a later ride.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05 — Claimed by the automated remediation agent on `fix/a01-session-engine-ownership`. Reproduced both audit sequences in Jest against the real `MetronomeEngine`, then moved the engine and the bike observers to a root-owned lifecycle hook. Status set to Done; PR open, not merged.

## Completion / disposition record

**Change summary.** Session lifecycle ownership moved out of the screen-mounted hook.

- New `src/features/training/sessionController.ts` owns the module-scoped `MetronomeEngine`, the in-flight FTMS Stop promise and the intentional-disconnect suppression flag, plus every command (`startSession`, `pauseSession`, `resumeSession`, `finishSession`, `finishSessionAndDisconnect`, `resetSession`, `freezeActiveSession`, `syncSessionFromBikeStatus`). Commands only move the store phase; they never start the clock.
- New `src/features/training/hooks/useTrainingSessionLifecycle.ts` is the single root owner. It is mounted once from `src/bootstrap/useAppInitialization.ts` (the documented app-boot seam), reconciles the one engine against the store phase, and holds the bike-status observer plus the disconnect and stale-telemetry watchdogs.
- `src/features/training/hooks/useTrainingSession.ts` is now an effect-free consumer: store selectors plus stable command references. Mounting it starts nothing, unmounting it stops nothing, so Home and Training can both mount it.
- `advanceSession` and the `trainingSessionStore` tick path are unchanged. `AGENTS.md` gains a "Session ownership" domain-model rule; `ROADMAP.md` aggregate audit item flipped to `[~]`.

**Commit / PR.** Branch `fix/a01-session-engine-ownership`, PR https://github.com/mike927/omni-bike-rn/pull/108 (open, not merged).

**Executed commands and outcomes.**

- `npx jest src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts` before the fix: 4 of 6 failed, reproducing the audit exactly. Bike-started ride paused and resumed from Training advanced `elapsedSeconds` by 2 in one simulated second (expected 1); Back and reopen left `elapsedSeconds` frozen at 0 while the phase stayed Active.
- `npx jest src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts` after the fix: 6 of 6 passed.
- `npx jest src/features/training`: 13 suites, 124 tests passed.
- `npm run ci:gate` (lint + typecheck + `jest --ci --runInBand`): passed. 108 suites, 1022 tests, 0 lint errors with `--max-warnings 0`.

**Regression evidence.** The new suite `src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts` runs the real `MetronomeEngine` on fake timers with the root lifecycle and two independent consumer trees, and covers: one second per simulated second with both consumers mounted; the bike-Started origin followed by Pause/Resume from Training; zero accumulation while Paused regardless of which consumer paused; Back and reentry of the Training consumer; finish and reset leaving no running clock (`isSessionEngineRunning()` false); and a later ride recording after a stale consumer unmounted. The existing `useTrainingSession` suite was retargeted at the new seam (it mounts the lifecycle alongside the consumer) and still passes unchanged in substance.

**Physical-device results.** None. This change is JS-only, with no native module or build change, and the reproduction is deterministic in Jest, so no device build was produced. On-device confirmation of the navigation path (start a ride, press Back from Training, reopen Training, Pause/Resume) is worth folding into the A11 device pass rather than run as a separate campaign.

**Remaining limitations and follow-ups.**

- Engine reconciliation runs in a React effect on the root hook, so the clock changes one commit after the phase does. Ticks are guarded by `phase === Active` inside the store, so no sample is accumulated in that window, but the seam is a React effect and not a store subscription.
- Teardown (`resetSessionAndConnections`) stops the clock before the phase reaches Idle. This is deliberate, so a reset from Active never flickers through Paused while still not accumulating into an abandoned ride, and it is the one place where the owner stops the clock ahead of the phase.
- A06 (manual pause precedence) lands in `syncSessionFromBikeStatus` in `sessionController.ts`, which is now the only place a bike Started event can resume a ride. A02 (persistence failure recovery) can hook the same controller commands, since `finishSession` / `finishSessionAndDisconnect` are the only finish paths.
