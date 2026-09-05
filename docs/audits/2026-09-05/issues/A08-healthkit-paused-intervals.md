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
- 2026-09-05: Fix round after independent review (verdict CHANGES_REQUIRED, spec MET). A partly unreadable pause history now reads as unknown instead of as its surviving entries, and is therefore never rewritten over the row. A rejected `addWorkoutEvents` now logs and saves the ride instead of failing the whole export, recorded above as a deliberate decision. The `tsconfig.json` `paths` block was reverted: it was a no-op outside the reviewing worktree. Tests added for the write-then-read round trip, which no shipped test covered. Status still In progress; the rebuild and device pass are unchanged and still outstanding.
- 2026-09-05: Rebased onto `main` after A07 (`Export workout-relative distance...`, PR #114) merged first and took the `0002` Drizzle slot with `0002_damp_ink.sql`. Kept both `AGENTS.md` additions (A07's "Distance is workout-relative" plus this ticket's "Ride pause history"), took main's journal/snapshots, dropped the old `0002_premium_wildside.sql`, then regenerated the migration from `schema.ts` as `0003_dark_mystique.sql`, containing only the additive `pause_events` column. `db:check` and `ci:gate` both clean. Status unchanged, still In progress; the rebuild and device pass are unchanged and still outstanding.

## Completion / disposition record

**Change summary.** A ride now keeps its own pause history, and Apple Health is told about it.

- `training_sessions` gains a nullable `pause_events` TEXT column (Drizzle migration `0003_dark_mystique`, a plain additive `ALTER TABLE ... ADD`; regenerated after rebasing onto A07's `0002_damp_ink`, which took the `0002` slot first). It holds a JSON array of `SessionPauseEvent` (`{ kind: 'pause' | 'resume', atMs }`), ordered and strictly alternating, starting with a pause.
- `updateSessionStatus` writes the status change and its matching pause or resume event in one transaction, so a ride's status and its history cannot disagree. `createDraftSession` starts a ride with `'[]'`. `normalizeRecoveredSessionToPaused` closes the recording interval of a ride whose process was killed, at the ride's last durable second, which is when the effort actually stopped.
- Why a ride paused is deliberately not modelled here. A manual pause (A06), a bike-driven pause and a disconnect pause all stop the 1 Hz clock and all stop `elapsedSeconds`, so for reconstructing the effort they are one fact. A06's manual-intent flag stays what it is: a resume-precedence rule, untouched.
- `saveWorkout` maps the history through the pure `toWorkoutEvents` and passes it to the native module, which adds it to `HKWorkoutBuilder` via `addWorkoutEvents` before `endCollection`. This is HealthKit's own mechanism: the builder excludes the span between a pause and the next resume from the workout's elapsed time. The workout keeps its true start and end, so no sample is stranded outside it, which is why shortening `endDate` was rejected.
- **Old-row policy.** `pause_events` is NULL for every row written before this change. NULL means "the history is unknown", which is not the same as `[]` ("this ride had no pauses"). An unknown history exports as a single continuous effort, exactly as before, and is never appended to: the row's elapsed seconds prove that such a ride was paused, but nothing in it says *when*, and an invented interval would mark real effort as a break. That also stops a legacy interrupted ride from picking up a lone event on resume, which would imply an active duration nothing supports.
- **A corrupt history is unknown, not partly known.** `parsePauseEvents` reports the whole array as unknown if any entry fails validation, instead of returning the entries that parsed. A history with an entry missing is not a shorter history, it is a different ride: drop a `resume` and what is left reads as "paused and never resumed", which exports real effort as a break, so a partly readable row would claim more certainty than a totally unreadable one. It also keeps `appendPauseEvent` from serialising the narrowed list back over the column, which would delete the unreadable entries for good on the next pause or resume.
- **Decision: a rejected `addWorkoutEvents` logs and still saves the ride.** HealthKit refusing the event array does not fail the export. The events are a correction to the ride's duration; the samples are the ride. Failing loud here would trade the wrong duration that every paused ride already exported before this change for no workout in Health at all, on a path that used to succeed, and no retry the app could make would persuade HealthKit to accept an array it just refused. So the native module logs the refusal through `NSLog` and continues to `endCollection`, the way `addMetadata` in the same file already treats enrichment. Sample failures stay fail-loud and unchanged. This also means the builder is no longer left begun and never ended on this path.
- `ExportProvider` is unchanged: the history travels on `PersistedTrainingSession`, so the orchestrator learned nothing Apple-specific and Strava/TCX were not touched.
- No shared configuration was changed. An earlier revision of this branch added a `paths` block to `tsconfig.json`; it was reverted, because it was a no-op in a normal clone and only papered over a worktree whose `node_modules` was a symlink into another checkout. The real cause was the worktree layout, and it was fixed by installing real dependencies there.

**Commands and outcomes.**

- `npm run ci:gate` (lint, typecheck, full suite): clean, `tsc --noEmit` exit 0 with `tsconfig.json` unmodified, 113 suites / 1138 tests pass.
- `npm run db:generate` then `npm run db:check`: generated `drizzle/0002_premium_wildside.sql`, check reports "Everything's fine". Re-run after rebasing onto main (A07 took the `0002` slot): regenerated as `drizzle/0003_dark_mystique.sql`, containing only the `pause_events` column addition; `db:check` again reports "Everything's fine".
- `xcrun swiftc -parse` on `AppleHealthWorkoutModule.swift`: clean. The rewritten `addWorkoutEvents` completion was also typechecked as a standalone probe against the real iOS SDK (`-sdk iphoneos -target arm64-apple-ios16.0`): exit 0. That proves shape only, not HealthKit behaviour.
- Reproduction was verified by mutation, not just by writing tests. Removing `workoutEvents` from the native payload fails all four `saveWorkout pause history` tests; removing the event write from `updateSessionStatus` fails `records a pause event with the status change` and `records a resume event with the status change`; removing it from `normalizeRecoveredSessionToPaused` fails `closes the recording interval of a recovered ride at its last durable second`; dropping the unknown-history guard fails `never writes a partial history onto a ride recorded before pause capture`; filtering a corrupt history instead of rejecting it fails `reports a partly unreadable pause history as unknown, not as the entries that survived` and `never rewrites a partly unreadable pause history over the row`; moving `pause_events` in the insert column list without moving its bound argument fails both `reads back ...` round-trip tests while every statement-text assertion still passes.

**Remaining limitations.**

- `modules/apple-health-workout/ios/AppleHealthWorkoutModule.swift` changed, so a rebuild is required and Jest cannot prove the HealthKit side. Outstanding evidence: a device build, a recorded ride with a real pause, and the Apple Health / Fitness entry showing a duration equal to the active time with the pause visible in the workout's event history.
- Specifically unproven without the device: that HealthKit treats a trailing pause (a ride finished while paused) as running to the workout's end, and that `addWorkoutEvents` accepts an event landing exactly on the workout's start or end boundary.
- Rides recorded before this change keep exporting as continuous efforts. That is the chosen policy, not a defect, and no backfill is planned.
- The log-and-continue branch for a rejected `addWorkoutEvents` cannot be exercised from Jest and has no known trigger: it needs HealthKit to refuse an array the app already validated and clamped. Its shape is typechecked against the SDK; its behaviour would only show up in the device log as the `[AppleHealthWorkoutModule] addWorkoutEvents failed` line next to a workout that still saved.
- The pause history reaches Apple Health but not TCX, so Strava still receives a paused ride as one continuous effort. Out of scope for this ticket; the coordinator is filing it separately.
