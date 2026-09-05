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
- 2026-09-05: claimed by the automated remediation agent on `fix/a01-session-engine-ownership`. Reproduced both audit sequences in Jest against the real `MetronomeEngine`, then moved the engine and the bike observers to a root-owned lifecycle hook. Status set to Done; PR open, not merged.
- 2026-09-05: review round 1 returned CHANGES_REQUIRED (spec MET, no correctness blocker). Fix round 1 made the Paused/Finished timer assertions bind, restored the exact `stop()` call count, moved the Watch remote into the root-owned lifecycle, asserted the single boot-time mount, and corrected the RED evidence recorded below. Status stays Done; PR still open, not merged.

## Completion / disposition record

**Change summary.** Session lifecycle ownership moved out of the screen-mounted hook.

- New `src/features/training/sessionController.ts` owns the module-scoped `MetronomeEngine`, the in-flight FTMS Stop promise and the intentional-disconnect suppression flag, plus every command (`startSession`, `pauseSession`, `resumeSession`, `finishSession`, `finishSessionAndDisconnect`, `resetSession`, `freezeActiveSession`, `syncSessionFromBikeStatus`). Commands only move the store phase; they never start the clock.
- New `src/features/training/hooks/useTrainingSessionLifecycle.ts` is the single root owner. It is mounted once from `src/bootstrap/useAppInitialization.ts` (the documented app-boot seam), reconciles the one engine against the store phase, and holds the bike-status observer plus the disconnect and stale-telemetry watchdogs.
- `src/features/training/hooks/useTrainingSession.ts` is now an effect-free consumer: store selectors plus stable command references. Mounting it starts nothing, unmounting it stops nothing, so Home and Training can both mount it.
- The Watch remote moved to the root too (fix round 1). `src/features/training/hooks/useWatchRideRemote.ts` binds on-wrist Pause / Resume / End to the controller commands and is mounted by `useTrainingSessionLifecycle`; `TrainingDashboardScreen` no longer mounts `useWatchRemoteControl`. Without this, after Back the ride and the Watch workout kept running while every wrist tap was silently dropped, which contradicted the rule this change adds to `AGENTS.md`. The post-finish route is shared by both paths through `resolvePostFinishRoute` in `navigation/trainingSummaryRoute.ts`.
- `advanceSession` and the `trainingSessionStore` tick path are unchanged. `AGENTS.md` gains a "Session ownership" domain-model rule; `ROADMAP.md` aggregate audit item flipped to `[~]`.

**Commit / PR.** Branch `fix/a01-session-engine-ownership`, PR https://github.com/mike927/omni-bike-rn/pull/108 (open, not merged).

**Executed commands and outcomes.**

**RED evidence (corrected in fix round 1).** The first record here claimed "4 of 6 failed" before the fix. That number was wrong, and the run as described was not reproducible: the suite as committed imports `useTrainingSessionLifecycle` and `isSessionEngineRunning`, both introduced by the same commit (`a40dd9f`), so it cannot resolve against baseline `58cd8f1` as written. What was actually observed, re-run in fix round 1:

- Baseline `58cd8f1` exported with `git archive` into a scratch directory, the repository `node_modules` symlinked in (symlink removed afterwards), plus **two shims** the file needs to resolve: `src/features/training/hooks/useTrainingSessionLifecycle.ts` exporting a no-op hook, and `src/features/training/sessionController.ts` exporting `isSessionEngineRunning()` returning `false`.
- `npx jest src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts` with the suite as committed at `a40dd9f`: **3 of 6 failed**, not 4. The failures are the bike-started Pause/Resume clock (expected 1, received 2), the Paused accumulation (expected 2, received 3) and Back/reentry (expected 1, received 0), which are exactly the two audit sequences. The other 3 tests passed against the old code and therefore did not bind.
- Same baseline and shims, with the fix-round suite (10 tests): **8 of 10 failed**. Read this figure with care: the shim's `isSessionEngineRunning()` returns `false` unconditionally and no Watch listener exists at baseline, so part of those failures reflect the shims and the absent root owner rather than a mis-timed clock. The load-bearing baseline evidence remains the three `elapsedSeconds` failures above.

**Command outcomes.**

- `npx jest src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts` after the fix, fix round 1: 10 of 10 passed.
- `npx jest src/features/training`: 13 suites, 129 tests passed.
- Mutation checks run in fix round 1, each reverted immediately: removing `engine?.stop()` from `syncSessionEngineToPhase` fails 2 ownership tests (it failed none before); deleting the early `stopSessionEngine()` in `resetSessionAndConnections` fails 1 `useTrainingSession` test (it failed none before); mounting the Watch remote from the Training screen instead of the root fails 5 tests across 2 suites; giving `useTrainingSession` an engine-stopping unmount effect fails the Back/reentry and stale-consumer tests.
- `npm run ci:gate` (lint + typecheck + `jest --ci --runInBand`): passed. 108 suites, 1022 tests, 0 lint errors with `--max-warnings 0` (first round). Re-run green in fix round 1; see the fix-round figures in the report.

**Regression evidence.** The suite `src/features/training/hooks/__tests__/trainingSessionOwnership.test.ts` runs the real `MetronomeEngine` on fake timers with the root lifecycle and two independent consumer trees, and covers: one second per simulated second with both consumers mounted; the bike-Started origin followed by Pause/Resume from Training; two full Pause/Resume cycles issued from the consumer that did not start the ride, asserting `isSessionEngineRunning()` at every edge so "zero while Paused" binds on the timer itself and not only on the store's phase guard; Back and reentry of the Training consumer; finish and reset each leaving no running clock; a later ride recording after the starting consumer unmounted mid-ride; and the wrist remote being owned by the root (subscribed with no screen mounted, still driving Pause / Resume / End after Back, and ignoring a stray End with no ride running). `src/bootstrap/__tests__/useAppInitialization.test.ts` asserts the lifecycle is mounted exactly once at boot and stays mounted across a database-init retry. `src/features/training/screens/__tests__/TrainingDashboardScreen.test.tsx` asserts the screen mounts no wrist remote of its own. The `useTrainingSession` suite was retargeted at the new seam (it mounts the lifecycle alongside the consumer) and pins the teardown `stop()` count at exactly 2.

**Physical-device results.** None. This change is JS-only, with no native module or build change, and the reproduction is deterministic in Jest, so no device build was produced. On-device confirmation of the navigation path (start a ride, press Back from Training, reopen Training, Pause/Resume) is worth folding into the A11 device pass rather than run as a separate campaign.

**Remaining limitations and follow-ups.**

- Engine reconciliation runs in a React effect on the root hook, so the clock changes one commit after the phase does. Ticks are guarded by `phase === Active` inside the store, so no sample is accumulated in that window, but the seam is a React effect and not a store subscription.
- Teardown (`resetSessionAndConnections`) stops the clock before the phase reaches Idle. This is deliberate, so a reset from Active never flickers through Paused while still not accumulating into an abandoned ride, and it is the one place where the owner stops the clock ahead of the phase. On that path `stop()` is called twice; the count is pinned at 2 by the `useTrainingSession` suite so the early stop cannot be dropped silently.
- On-wrist End now navigates from the root through the imperative `expo-router` `router`, so it works with no Training screen mounted. Suites that load the root lifecycle therefore stub `expo-router` and `watch-connectivity`, which are not importable under Jest.
- A06 (manual pause precedence) lands in `syncSessionFromBikeStatus` in `sessionController.ts`, which is now the only place a bike Started event can resume a ride. A02 (persistence failure recovery) can hook the same controller commands, since `finishSession` / `finishSessionAndDisconnect` are the only finish paths.
