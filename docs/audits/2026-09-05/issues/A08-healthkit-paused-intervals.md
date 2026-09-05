# A08 — Apple Health export loses paused intervals

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | In progress |
| Owner | automated remediation agent |
| Branch / PR | `fix/a08-healthkit-paused-intervals` / https://github.com/mike927/omni-bike-rn/pull/115 |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | correctness |
| Severity | Medium |
| Priority | P2 — Planned |
| Evidence | Confirmed — static payload/native-builder trace and official duration semantics |
| Estimated effort | Medium |

## Dependencies and coordination

Coordinate lifecycle event persistence with A01/A02 and schema work with A07.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/services/health/appleHealthAdapter.ts](<../../../../src/services/health/appleHealthAdapter.ts>) — audit lines/section 359–388.
- [modules/apple-health-workout/ios/AppleHealthWorkoutModule.swift](<../../../../modules/apple-health-workout/ios/AppleHealthWorkoutModule.swift>) — audit lines/section 158–173, 257–277.
- [src/services/db/schema.ts](<../../../../src/services/db/schema.ts>) — audit lines/section 23–71.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Export passes the original start and actual finish timestamps but no pause/resume events. The native HKWorkoutBuilder creates a continuous workout rather than preserving active duration.

## Triggering scenario

Record 10 active minutes, pause for 20 minutes, then finish and export to Apple Health.

## Expected versus observed / evidence

The app has approximately 600 active elapsed seconds, while the builder receives a 30-minute window with no pause events. Expected: HealthKit duration preserves paused intervals. Apple Fitness presentation was not inspected during the audit.

Apple documents that workout duration excludes intervals between pause/resume events: [HKWorkoutBuilder elapsedTime(at:)](https://developer.apple.com/documentation/healthkit/hkworkoutbuilder/elapsedtime(at:)).

## Impact and triage

Medium/P2: paused and interrupted/restored rides can have inconsistent duration between the app and HealthKit. The issue is limited to export semantics for such rides.

## Smallest sound correction or improvement

Persist lifecycle event timestamps and pass pause/resume events to the builder. Shortening endDate alone would misplace or exclude later samples. Define an approximation policy for old workouts lacking exact pause events.

## Acceptance criteria and verification

- [ ] Export a known active/pause timeline and compare HKWorkout.duration, event history, and sample timestamps. **Outstanding: needs a device.** The exported payload is covered by unit tests (`saveWorkout pause history`), but only HealthKit can be observed to subtract the interval.
- [x] Cover finish while paused, several pauses, and interrupted-session restoration. Covered as payload and persistence behaviour by `workoutPauseEvents.test.ts`, `appleHealthAdapter.test.ts` and `trainingSessionRepository.test.ts`; the HealthKit-side result of each still needs the device pass above.
- [ ] Verify old-row behavior explicitly; native code changes require a rebuild and physical verification. **Partially done:** the old-row policy (unknown history exports as one continuous effort, and is never written to) is unit-tested; the rebuild and Health-app inspection are outstanding.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index. `ROADMAP.md` already carries the aggregate item as `[~]`, which stays correct while remediation continues.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: Claimed on `fix/a08-healthkit-paused-intervals`. Reproduced the finding as a failing test (the native save payload carried no pause events at all), then persisted a per-ride pause/resume history and exported it as HKWorkout events. Status stays In progress: the native module changed, so the HealthKit-side result needs a rebuild and an on-device check.

## Completion / disposition record

**Change summary.** A ride now keeps its own pause history, and Apple Health is told about it.

- `training_sessions` gains a nullable `pause_events` TEXT column (Drizzle migration `0002_premium_wildside`, a plain additive `ALTER TABLE ... ADD`). It holds a JSON array of `SessionPauseEvent` (`{ kind: 'pause' | 'resume', atMs }`), ordered and strictly alternating, starting with a pause.
- `updateSessionStatus` writes the status change and its matching pause or resume event in one transaction, so a ride's status and its history cannot disagree. `createDraftSession` starts a ride with `'[]'`. `normalizeRecoveredSessionToPaused` closes the recording interval of a ride whose process was killed, at the ride's last durable second, which is when the effort actually stopped.
- Why a ride paused is deliberately not modelled here. A manual pause (A06), a bike-driven pause and a disconnect pause all stop the 1 Hz clock and all stop `elapsedSeconds`, so for reconstructing the effort they are one fact. A06's manual-intent flag stays what it is: a resume-precedence rule, untouched.
- `saveWorkout` maps the history through the pure `toWorkoutEvents` and passes it to the native module, which adds it to `HKWorkoutBuilder` via `addWorkoutEvents` before `endCollection`. This is HealthKit's own mechanism: the builder excludes the span between a pause and the next resume from the workout's elapsed time. The workout keeps its true start and end, so no sample is stranded outside it, which is why shortening `endDate` was rejected.
- **Old-row policy.** `pause_events` is NULL for every row written before this change. NULL means "the history is unknown", which is not the same as `[]` ("this ride had no pauses"). An unknown history exports as a single continuous effort, exactly as before, and is never appended to: the row's elapsed seconds prove that such a ride was paused, but nothing in it says *when*, and an invented interval would mark real effort as a break. That also stops a legacy interrupted ride from picking up a lone event on resume, which would imply an active duration nothing supports.
- One change sits outside the finding: `tsconfig.json` now maps the two in-repo Expo modules (`apple-health-workout`, `watch-connectivity`) to their own source. Without it `npm run typecheck` resolves them through `node_modules`, which in a git worktree is a symlink into another checkout, so the gate silently typechecks the app against a different branch's native module. Resolution on `main` is unchanged, since both mappings point at the same files `node_modules` already linked to.
- `ExportProvider` is unchanged: the history travels on `PersistedTrainingSession`, so the orchestrator learned nothing Apple-specific and Strava/TCX were not touched.

**Commands and outcomes.**

- `npx jest` (full suite): 113 suites, 1134 tests, all pass.
- `npm run lint`: clean (`eslint . --max-warnings 0`).
- `npm run db:generate` then `npm run db:check`: generated `drizzle/0002_premium_wildside.sql`, check reports "Everything's fine".
- Typecheck: `npx tsc --noEmit` in the shared worktree reports two errors that are an artefact of the worktree, not of the change. `node_modules` is a symlink into the main checkout, so `apple-health-workout` (a `file:` dependency) resolves to the main checkout's copy of the module rather than this branch's. Re-running the identical typecheck with `apple-health-workout` mapped to `./modules/apple-health-workout/src/index.ts` passes with no errors. The gate must be re-run on the merged tree.
- Reproduction was verified by mutation, not just by writing tests. Removing `workoutEvents` from the native payload fails all four `saveWorkout pause history` tests; removing the event write from `updateSessionStatus` fails `records a pause event with the status change` and `records a resume event with the status change`; removing it from `normalizeRecoveredSessionToPaused` fails `closes the recording interval of a recovered ride at its last durable second`; dropping the unknown-history guard fails `never writes a partial history onto a ride recorded before pause capture`.

**Remaining limitations.**

- `modules/apple-health-workout/ios/AppleHealthWorkoutModule.swift` changed, so a rebuild is required and Jest cannot prove the HealthKit side. Outstanding evidence: a device build, a recorded ride with a real pause, and the Apple Health / Fitness entry showing a duration equal to the active time with the pause visible in the workout's event history.
- Specifically unproven without the device: that HealthKit treats a trailing pause (a ride finished while paused) as running to the workout's end, and that `addWorkoutEvents` accepts an event landing exactly on the workout's start or end boundary.
- Rides recorded before this change keep exporting as continuous efforts. That is the chosen policy, not a defect, and no backfill is planned.
