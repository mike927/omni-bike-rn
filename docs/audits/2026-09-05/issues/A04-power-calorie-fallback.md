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

- [x] Cover no HR, stale Watch HR, missing profile, and simultaneous power/bike energy. Covered in `sessionAccumulator.test.ts` (reducer) and `MetronomeEngine.test.ts` (engine wiring, including the Watch staleness drop).
- [x] Distinguish absent power from valid zero power and verify fallback priority. Absence is preserved at the source (`ZiproRaveAdapter.test.ts`: an energy-only FTMS packet emits no power value) and honoured by the engine (`MetronomeEngine.test.ts`: such a bike selects the bike-reported tier, a connected bike genuinely at 0 W selects the power tier, no bike selects neither). The reducer half, identical 0 W metrics with opposite outcomes decided only by the flag, is pinned in `sessionAccumulator.test.ts`.
- [x] Replace the existing test encoding zero calories with valid power; preserve source-switch rebasing tests. All Watch/bike/app rebasing tests still present and green.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: Fixed. Added `hasBikePower` to `TrainingTickInput` (a bike is connected and reporting, independent of HR); `MetronomeEngine` now sets it from `latestBikeMetrics !== null` instead of overloading `hasLiveExternalHr`; `advanceCalories` in `sessionAccumulator.ts` gates the power-based tier on `hasBikePower`. Updated `sessionAccumulator.test.ts`, `MetronomeEngine.test.ts`, `trainingSessionStore.test.ts`, and the two session-persistence test files for the new required field; replaced the bug-encoding "holds totalCalories ... zero" test and the "bike-reported calories when no live external HR" integration tests with corrected expectations (power now correctly outranks bike-reported energy even with no HR, matching the documented priority). Verified by mutation: reverting the `if (hasBikePower)` gate to `if (hasLiveExternalHr)` fails exactly the tests that reproduce this ticket (the 60-tick/200 W reducer reproduction plus 5 related tests), 14 failures total, then restored the fix and reran green.
- 2026-09-05 (fix round 1, after review verdict CHANGES_REQUIRED): the round-1 mechanism was the wrong proxy and introduced a regression of the same class as the audited bug. `hasBikePower = bikeMetrics !== null` treated the adapter's fabricated `power ?? 0` as a real reading, so an FTMS bike that reports energy but not Instantaneous Power selected the power tier at 0 W and recorded 0 kcal for the whole ride, discarding its own energy stream. Power presence is now preserved end to end instead: `BikeMetrics.power` is optional (`power?: number`), `ZiproRaveAdapter` no longer coerces a missing FTMS power field to `0`, its pre-first-packet `latestMetrics` seed no longer claims `power: 0`, and `MetronomeEngine.resolveBikePower` derives the flag from an actual reading. The same helper bounds the reading's freshness against `lastBikeSignalAtMs` (`BIKE_SIGNAL_STALE_TIMEOUT_MS`, 5 s, matching the lifecycle's stale-telemetry watchdog), so a silent BLE dropout stops the power tier instead of integrating the last known wattage forever. `MetricSnapshot.power` stays a plain number for DB, TCX and UI consumers. New tests: adapter-level power absence (data packet and status-before-data), engine-level energy-only bike, no-bike negative direction, staleness release and its live-bike counterpart. The "distinguishes a genuine zero watts" reducer test was retargeted and named for what it actually proves, and the two near-duplicate power tests were merged.

## Completion / disposition record

**PR:** https://github.com/mike927/omni-bike-rn/pull/111 (branch `fix/a04-power-calorie-fallback`, open, not merged). Reviewed once, verdict CHANGES_REQUIRED, then repaired in fix round 1; this record describes the final state.

**Change summary.** The power-based calorie tier in `advanceCalories` (`src/services/training/sessionAccumulator.ts`) was gated on `hasLiveExternalHr`, so a ride with valid power but no HR source fell through to the bike-reported tier (or to none, if the bike did not also report `totalEnergyKcal`), even though the documented priority (`AGENTS.md`, "Calorie source priority") ranks power-based above bike-reported and does not require HR for it. The tier is now gated on a new `hasBikePower: boolean` on `TrainingTickInput` (`src/types/training.ts`), which means "`metrics.power` is a real reading this tick". The Keytel tier's HR gate is untouched, and the documented tier order did not change: this fix corrects *when* the power tier is reachable, not the order.

Making that flag mean what it says required preserving power presence through the whole BLE path, because the adapter used to fabricate the value:

- `BikeMetrics.power` is now optional (`power?: number`, `src/services/ble/BikeAdapter.ts`). FTMS makes Instantaneous Power (flag bit 6) optional and independent of Total Energy (bit 8), and `bleDeviceValidator` accepts an Indoor Bike Data device without checking the power feature bit, so a bike that streams energy and never a watt is a supported device.
- `ZiproRaveAdapter` no longer writes `power: parsedMetrics.power ?? 0`, and its `latestMetrics` seed no longer claims `power: 0` before the first Indoor Bike Data packet (which a Machine Status event could otherwise publish as a real reading).
- `MetronomeEngine.resolveBikePower` derives the flag from an actual reading and additionally bounds its freshness against `lastBikeSignalAtMs` using `BIKE_SIGNAL_STALE_TIMEOUT_MS` (5 s, matching the lifecycle's stale-telemetry watchdog). A BLE stall does not always raise a disconnect, so without the bound the power tier would integrate the last known wattage for the rest of the ride.
- `MetricSnapshot.power` stays a plain non-nullable number. It is shared with DB persistence, TCX export and the dashboard, and "no reading" still renders there as 0; the flag, not the number, carries absence to the calorie tiers.

A consequence required by the documented priority, and called out in the ticket's own problem statement ("if [bike energy] is present, the reducer skips the higher-priority power tier"): a bike that reports real power now always outranks that same bike's own `totalEnergyKcal`, even with no HR. Several `MetronomeEngine.test.ts` tests encoded the old fallback-to-bike-reported behaviour as expected and were rewritten.

**Commands executed (fix round 1).**
- `npx jest src/services/ble src/services/metronome src/services/training` (7 suites, 137 passed).
- `npm run ci:gate` (`eslint . --max-warnings 0` + `tsc --noEmit` + `jest --ci --runInBand`): green, 111 suites, 1080 tests passed, 0 lint errors, 0 type errors.
- Reviewer's scenario re-run end to end (temporary probe, real `parseFtmsIndoorBikeData` on an energy-only FTMS packet, the adapter's merge shape, the real store and the real engine; probe deleted afterwards): parsed metrics carry no power value, and two ticks at `totalEnergyKcal` 500 then 510 yield **10 kcal, mode `bike`**. Pre-fix-round the same scenario yielded 0 kcal, mode `app`.
- Mutation checks, each reverted from a saved copy: restoring `power: parsedMetrics.power ?? 0` in the adapter fails the adapter's power-absence test; restoring `hasBikePower = bikeMetrics !== null` fails the engine's energy-only-bike test; removing the freshness bound fails "stops integrating power once the bike telemetry goes stale"; forcing `hasBikePower = true` (the mutation that survived the entire suite at review time) now fails 3 tests; reverting the reducer gate to `if (hasLiveExternalHr)` fails 15 tests including the ticket's 60-tick / 200 W reproduction. Full suite green again after every restore.

**Not covered.** No physical-device verification was performed. The energy-only bike is exercised through the real FTMS parser, the real store and the real engine, with the adapter's own merge reproduced at the store boundary rather than over live Bluetooth; no such machine was available on hardware. `AGENTS.md` needed no change (priority order preserved).

**Remaining limitations.**

- The bike-reported tier is alive and reachable, and this is the point of the fix. The earlier claim in this record that it was "effectively unreachable through the real `MetronomeEngine` wiring, since a connected bike's `power` field is always populated" was **wrong** and has been removed. It was true only of the TypeScript type at the time (`power: number`) and only because `ZiproRaveAdapter` coerced an absent FTMS power field to `0`; the repository's own parser test asserts an energy-only parse with no `power` key, and `bleDeviceValidator` accepts such a bike. The tier serves exactly that device class.
- `BIKE_SIGNAL_STALE_TIMEOUT_MS` (exported from `src/services/ble/BikeAdapter.ts`) duplicates the numeric value of the private `BIKE_SIGNAL_STALE_TIMEOUT_MS` in `src/features/training/hooks/useTrainingSessionLifecycle.ts`, which A01 owns. They are deliberately the same 5 s; the lifecycle constant should be replaced by an import of the exported one by whoever next touches that file.
