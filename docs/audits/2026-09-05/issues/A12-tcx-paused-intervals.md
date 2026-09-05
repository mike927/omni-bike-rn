# A12: TCX export loses paused intervals

[Audit index](../README.md) · Not part of the `965cbec` audit baseline: filed 2026-09-05 during A08 remediation.

## Tracking

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Branch / PR | None |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | export |
| Severity | Medium |
| Priority | P2 - Planned |
| Evidence | Confirmed - identified during A08 code review |
| Estimated effort | Small |

## Dependencies and coordination

Depends on A08 (merged as `8e7d5d9`, "Export a ride's paused intervals to Apple Health", which added the `training_sessions.pause_events` column and the `HKWorkoutEvent` export) and relates to A07 (merged as `f1be65d`, "Export workout-relative distance instead of raw bike counters", which owns TCX distance normalization but whose brief did not cover lifecycle events). The pause data already exists in the database; this ticket is only about surfacing it in TCX. No schema change is expected: `pause_events` already exists and is already read elsewhere.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/services/export/formats/tcxSerializer.ts](<../../../../src/services/export/formats/tcxSerializer.ts>): lines 51-79. `serializeSessionToTcx` builds exactly one `<Lap>` covering the ride's full `elapsedSeconds`/`totalDistanceMeters`, with a single continuous `<Track>` of trackpoints; it never reads `session.pauseEvents`.
- [src/services/db/trainingSessionRepository.ts](<../../../../src/services/db/trainingSessionRepository.ts>): lines 148-172 (`mapSessionRow` exposes `pauseEvents` on every loaded `PersistedTrainingSession`), lines 301-332 (`appendPauseEvent` / `updateSessionStatus` write a pause or resume event on every status change).
- [src/services/health/appleHealthAdapter.ts](<../../../../src/services/health/appleHealthAdapter.ts>): lines 372-393. `saveWorkout` reads `session.pauseEvents` and passes it through `toWorkoutEvents` to the native HealthKit export. The TCX path has no equivalent step.

Line references were read from the current tree at filing time, since this ticket postdates the `965cbec` audit baseline; they may still drift. Locate the named functions in the current tree.

## Problem

A08 made a ride's paused intervals reach Apple Health as canonical `HKWorkoutEvent` pause/resume events, persisted in `training_sessions.pause_events`. That same history never reaches the TCX export: `serializeSessionToTcx` only consumes `session.startedAtMs`, `session.elapsedSeconds`, `session.totalDistanceMeters`, `session.totalCaloriesKcal` and the sample series, so a provider that imports the TCX file, such as Strava, still sees a paused ride as one continuous effort. A07 normalized TCX distance in the same file but its brief did not cover lifecycle events, so this gap belonged to neither ticket.

## Triggering scenario

Record a ride that includes at least one pause and resume, finish it, and export it to a TCX-based provider (Strava, via `StravaExportProvider`).

## Expected versus observed / evidence

Expected: the TCX export reflects the ride's pause history in some form consistent with the TCX schema, the way A08's Apple Health export already reflects the same history via `HKWorkoutEvent`. Observed: a paused ride and an unpaused ride with the same elapsed time and distance produce structurally identical TCX output, because `serializeSessionToTcx` never reads `session.pauseEvents`. This was found by inspection while reviewing A08's change, not by an executed device reproduction.

## Impact and triage

Medium/P2: this is an export-fidelity gap, not a data-loss gap. The pause history is durable in `training_sessions.pause_events` and available for a future fix; only the TCX artifact is impoverished. Severity and priority mirror A08, since this is the same underlying finding surfacing in a second export path.

## Smallest sound correction or improvement

TCX has no single-element pause marker. The established way to represent an active/paused/active ride in TCX is multiple `<Lap>` elements, one per active segment, rather than a flag on one lap, so this is not a one-line addition: it changes `serializeSessionToTcx` from a single-lap emitter into one driven by `session.pauseEvents` (with a defined fallback for the rows A08 already leaves with `pauseEvents === null`, consistent with A08's own old-row policy of exporting those as a single continuous effort). Whichever shape is chosen, each lap's own distance and time must stay internally consistent with A07's normalized per-sample distance series (`resolveWorkoutDistancePoints`) and with the session-level totals. This ticket records the gap; it does not choose the lap shape or write the fix.

## Acceptance criteria and verification

- [ ] Reproduce the current gap: export a ride with at least one recorded pause/resume to TCX and show the pause boundary is not represented in the output.
- [ ] Decide and implement a TCX-schema-consistent representation of `session.pauseEvents` (for example, one `<Lap>` per active segment), keeping each lap's distance and time consistent with A07's normalized distance series and with the session totals.
- [ ] Define and test the fallback for sessions where `pauseEvents` is `null` (rows predating A08), matching A08's documented old-row policy rather than inventing intervals.
- [ ] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [ ] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05: Filed from the A08 code review. Independent review of A08 (merged as `8e7d5d9`) found that the ride pause history it added does not reach the TCX export, so Strava still receives a paused ride as one continuous effort; A07 (merged as `f1be65d`) owns TCX distance but its brief did not cover lifecycle events. Filed as a new ticket, since neither A07 nor A08's brief owned this gap. Status is Not started; no remediation performed.

## Completion / disposition record

No implementation, PR or new verification recorded yet. Before closing, replace this paragraph with:

- Change summary and commit/PR (or evidence-backed reason for deferral/rejection).
- Executed commands with outcomes and relevant regression evidence.
- Physical-device results where required, including build revision and log references.
- Remaining limitations or follow-up issue links.
