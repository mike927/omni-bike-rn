# A07 — TCX exports raw bike distance counters

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Done |
| Owner | automated remediation agent |
| Branch / PR | `fix/a07-normalized-tcx-distance` / PR_URL_PLACEHOLDER |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | correctness |
| Severity | Medium |
| Priority | P2 — Planned |
| Evidence | Confirmed — reducer-to-serializer reproduction |
| Estimated effort | Medium |

## Dependencies and coordination

Coordinate persistence/schema changes with A08; reuse accumulator normalization.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/services/db/trainingSessionRepository.ts](<../../../../src/services/db/trainingSessionRepository.ts>) — audit lines/section 175–185.
- [src/services/export/formats/tcxSerializer.ts](<../../../../src/services/export/formats/tcxSerializer.ts>) — audit lines/section 20–31, 64–84.
- [src/services/training/sessionAccumulator.ts](<../../../../src/services/training/sessionAccumulator.ts>) — audit lines/section 27–48.
- [src/services/db/schema.ts](<../../../../src/services/db/schema.ts>) — audit lines/section 53–71.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Session totals normalize initial bike counters and resets, but persisted samples retain raw counters. TCX exports the raw sample distance whenever present.

## Triggering scenario

Record nonzero starting counters or a bike counter reset; the reproduction used 500 → 520 → 10 → 25 metres.

## Expected versus observed / evidence

Normalized session total was 35 m, but TCX trackpoints were 500, 520, 10, 25 m. Expected: cumulative workout-relative trackpoints consistent with the lap total. Exact Strava interpretation was not tested.



## Impact and triage

Medium/P2: exported data disagrees with local normalized totals for offsets/resets. The local total remains usable; hardware counter histories are a narrower scenario.

## Smallest sound correction or improvement

Persist normalized cumulative session distance per sample and export it. Keep normalization in the accumulator. Define reconstruction/fallback for older rows, whose exact normalized histories were not retained.

## Acceptance criteria and verification

- [x] Trace reducer → persistence → serializer for initial offsets, resets, restored rides, and speed-only distance.
- [x] Assert monotonic workout-relative trackpoints and agreement with final distance.
- [x] Test the explicit legacy-row fallback and document any approximation.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: claimed by the automated remediation agent on `fix/a07-normalized-tcx-distance`. Reproduced the finding as a failing serializer test (counters 500, 520, 10, 25 exported verbatim while the lap total read 35 m), then persisted the accumulator's normalized total per sample and made the serializer export it, reconstructing the series for rows written before the column existed.

## Completion / disposition record

### Change summary

The session accumulator already rebased the trainer's odometer onto the ride, but nothing downstream kept that
number: samples persisted only `metrics.distance`, the raw counter, and the TCX serializer exported it whenever
it was non-null. A ride of 35 m recorded on a bike that started at 500 m and power-cycled mid-ride exported
trackpoints of 500, 520, 10, 25 m under a lap total of 35 m.

- `src/services/training/sessionAccumulator.ts`: the distance rule is now a named, exported step,
  `normalizeDistanceStep(state, reading, elapsedDeltaSeconds)`, with `advanceDistance` calling it with one
  second. Normalization stays in the accumulator, as the ticket required; the live tick's behaviour is
  unchanged.
- `src/services/db/schema.ts` + `drizzle/0002_damp_ink.sql`: additive nullable column
  `training_session_samples.session_distance_meters`. Generated with `npm run db:generate`, verified with
  `npm run db:check`. No data rewrite, no migration framework.
- `src/services/db/trainingSessionRepository.ts`: `appendSample` writes the tick's normalized session total into
  the new column beside the raw counter; `getSamplesBySessionId` reads it back. A SQL `NULL` maps to an **absent**
  property, never to `0`, so "no normalized history was kept" stays distinguishable from "the rider had covered
  0 m", the presence-preserving pattern A04 established for bike power.
- `src/types/sessionPersistence.ts`: `PersistedTrainingSample.sessionDistanceMeters?: number`.
- `src/services/export/workoutDistanceSeries.ts` (new): `resolveWorkoutDistanceSeries(session, samples)` returns
  the cumulative workout-relative metres per sample. Recorded rows are used as-is; rows without the field are
  reconstructed by replaying `normalizeDistanceStep` over the persisted readings. The result is clamped
  non-decreasing, because a TCX `DistanceMeters` is cumulative and a dip reads as a rewind.
- `src/services/export/formats/tcxSerializer.ts`: trackpoints come from that series, so the track and the lap
  total are measured on the same origin. The serializer no longer reads `metrics.distance` at all.
- `AGENTS.md`: the Session accumulation rule now states that distance is workout-relative, that
  `MetricSnapshot.distance` is the machine's raw counter, and that exports must never publish it as a
  per-second distance.

### Rides already in the database

Existing rows keep their raw counters and get `NULL` in the new column; nothing is rewritten. They export the
**reconstructed** series, computed at read time rather than backfilled, because their exact normalized history
was never retained, a backfill would freeze one guess into the database irreversibly, and an on-device data
rewrite is a far riskier migration than an additive column. Reconstruction is exact for an uninterrupted 1 Hz
sample stream. Two documented approximations remain, both recorded in the module's own documentation: a second
whose sample write failed is replayed as the surrounding reading held across the gap, and a ride resumed after
the app was killed rebases the live counter while a straight replay does not, so the replay can run slightly
ahead of the stored total across such a gap. A legacy ride that reconstructs to nothing at all (no counter, no
speed, yet a non-zero stored total) falls back to spreading that total over elapsed time, which is the previous
behaviour narrowed to the only case where it was ever the sole signal.

### Executed commands

| Command | Outcome |
| --- | --- |
| `npm run db:generate` | Emitted `drizzle/0002_damp_ink.sql` (`ALTER TABLE training_session_samples ADD session_distance_meters real;`) |
| `npm run db:check` | `Everything's fine` |
| `npx jest src/services/export/formats/__tests__/tcxSerializer.test.ts` (before the fix) | 3 failed, 19 passed: the reproduction |
| `npm run ci:gate` | Exit 0: lint clean, `tsc --noEmit` clean, 113 suites / 1127 tests passed |

### Mutation evidence

Each new test was checked against the pre-fix code rather than only against the fix:

- Serializer restored from `main`: the three reproduction tests fail (raw counters 500/520/10/25 and 1010/1020/1040 exported).
- Repository restored from `main`: the new column write and read-back tests fail.
- Monotonic clamp removed: `never decreases, because a TCX trackpoint distance is cumulative` fails.
- Legacy reconstruction removed: the four legacy-row tests fail.

### Remaining limitations

- The migration has run only through `drizzle-kit`. It has not been applied to a real on-device SQLite file,
  so the on-device upgrade of an existing database is unverified.
- How Strava interprets either the old or the new trackpoints was not tested, matching the audit's own
  statement. No provider round trip was performed, and none is claimed.
- Nothing verifies the end-to-end path on real hardware: a ride recorded on a trainer with a non-zero starting
  counter, exported and inspected, is still outstanding.
