# A04 — Power calorie fallback incorrectly requires live HR

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Done |
| Owner | automated remediation agent |
| Branch / PR | fix/a04-power-calorie-fallback / https://github.com/mike927/omni-bike-rn/pull/111 |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | correctness |
| Severity | Medium |
| Priority | P1 — Next |
| Evidence | Confirmed — pure reducer reproduction |
| Estimated effort | Small |

## Dependencies and coordination

Independent. Preserve the canonical calorie reducer and source-priority contract.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/services/training/sessionAccumulator.ts](<../../../../src/services/training/sessionAccumulator.ts>) — audit lines/section 87–140.
- [src/services/metronome/MetronomeEngine.ts](<../../../../src/services/metronome/MetronomeEngine.ts>) — audit lines/section 109–140.
- [src/services/training/__tests__/sessionAccumulator.test.ts](<../../../../src/services/training/__tests__/sessionAccumulator.test.ts>) — audit lines/section 63–81.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

The documented priority is Watch → HR/profile → power → bike calories. The power branch instead requires `hasLiveExternalHr`.

## Triggering scenario

Ride with valid power but no fresh HR. If bike energy is absent, calories stop accumulating; if it is present, the reducer skips the higher-priority power tier.

## Expected versus observed / evidence

60 ticks at 200 W, no HR and no bike energy produced 0 kcal. The existing power formula produces approximately 11.47 kcal. An existing test explicitly expects zero despite valid power.



## Impact and triage

Medium/P1: this affects the supported optional-HR workflow and HR outages; saved/exported calories can be wrong while other metrics remain usable.

## Smallest sound correction or improvement

Gate power on valid power availability, not HR liveness. Preserve absent power separately from a valid zero reading; the merged snapshot currently defaults absent power to zero. Keep source selection within `advanceSession`.

## Acceptance criteria and verification

- [x] Cover no HR, stale Watch HR, missing profile, and simultaneous power/bike energy.
- [x] Distinguish absent power from valid zero power and verify fallback priority.
- [x] Replace the existing test encoding zero calories with valid power; preserve source-switch rebasing tests.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: Fixed. Added `hasBikePower` to `TrainingTickInput` (a bike is connected and reporting, independent of HR); `MetronomeEngine` now sets it from `latestBikeMetrics !== null` instead of overloading `hasLiveExternalHr`; `advanceCalories` in `sessionAccumulator.ts` gates the power-based tier on `hasBikePower`. Updated `sessionAccumulator.test.ts`, `MetronomeEngine.test.ts`, `trainingSessionStore.test.ts`, and the two session-persistence test files for the new required field; replaced the bug-encoding "holds totalCalories ... zero" test and the "bike-reported calories when no live external HR" integration tests with corrected expectations (power now correctly outranks bike-reported energy even with no HR, matching the documented priority). Verified by mutation: reverting the `if (hasBikePower)` gate to `if (hasLiveExternalHr)` fails exactly the tests that reproduce this ticket (the 60-tick/200 W reducer reproduction plus 5 related tests), 14 failures total, then restored the fix and reran green.

## Completion / disposition record

**PR:** https://github.com/mike927/omni-bike-rn/pull/111 (branch `fix/a04-power-calorie-fallback`, open, not merged).

**Change summary.** The power-based calorie tier in `advanceCalories` (`src/services/training/sessionAccumulator.ts`) was gated on `hasLiveExternalHr`, so a ride with valid power but no HR source fell through to the bike-reported tier (or to none, if the bike didn't also report `totalEnergyKcal`), even though the documented priority (`AGENTS.md`, "Calorie source priority") ranks power-based above bike-reported and does not require HR for it. Fix: added a new `hasBikePower: boolean` field to `TrainingTickInput` (`src/types/training.ts`), distinct from `MetricSnapshot.power` (kept non-nullable and untouched, since it is shared with DB persistence, TCX export and UI code outside this ticket's scope). `MetronomeEngine.mergeMetrics` sets it to `bikeMetrics !== null`, which is the only way to tell a connected bike reporting a genuine zero watts apart from the "no bike" default of `power = 0`. `advanceCalories` now gates the power tier on `hasBikePower` instead of `hasLiveExternalHr`; the Keytel tier's HR gate is untouched. The documented priority order in `AGENTS.md` did not need changing: this fix corrects *when* the power tier is reachable, not the tier order itself.

A side effect of the fix, required by the documented priority and called out loudly per the ticket's own problem statement ("if [bike energy] is present, the reducer skips the higher-priority power tier"): whenever a bike is connected and reporting power, the power-based tier now always outranks that same bike's own `totalEnergyKcal`, even with no HR present. Several `MetronomeEngine.test.ts` integration tests previously encoded the old (incorrect) fallback-to-bike-reported behavior as the expected result; these were rewritten to assert the corrected `'app'`-tier behavior (see work log above for the full list).

**Commands executed.**
- `npx jest src/services/training/__tests__/sessionAccumulator.test.ts` (29 passed).
- `npx jest src/services/metronome/__tests__/MetronomeEngine.test.ts` (24 passed).
- `npx jest src/store/__tests__/trainingSessionStore.test.ts` (21 passed).
- `npx jest src/features/training/hooks/__tests__/useTrainingSessionPersistence.test.ts src/features/training/hooks/__tests__/sessionPersistenceRecovery.test.ts` (26 passed).
- `npm run ci:gate` (lint + typecheck + full `jest --ci --runInBand`): green, 111 suites, 1075 tests passed, 0 lint errors, 0 type errors.
- Mutation check: temporarily reverted the `if (hasBikePower)` condition back to `if (hasLiveExternalHr)` and reran the affected suites; 14 tests failed, including the ticket's own reproduction ("reproduces the audited fallback: 60 ticks at 200 W..."). Restored the fix; full suite green again.

**Not covered.** No physical-device verification is required or applicable: this is a pure-reducer and unit-level fix with no native/BLE/HealthKit surface. No `AGENTS.md` contract text needed to change (priority order preserved).

**Remaining limitations.** None identified within this ticket's scope. Note for the record (not fixed here, out of scope): the "bike-reported" calorie tier is now effectively unreachable through the real `MetronomeEngine` wiring, since a connected bike's `power` field is always populated whenever `bikeMetrics` exists, so `hasBikePower` and "a bike is present" are equivalent in production. This matches the documented priority (power-based outranks bike-reported) and is exactly the ticket's intended correction, not a regression, but is worth knowing if `AGENTS.md`'s priority order is ever revisited.
