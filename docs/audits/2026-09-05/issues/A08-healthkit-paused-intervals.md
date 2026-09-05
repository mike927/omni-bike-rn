# A08 — Apple Health export loses paused intervals

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Branch / PR | None |
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

- [ ] Export a known active/pause timeline and compare HKWorkout.duration, event history, and sample timestamps.
- [ ] Cover finish while paused, several pauses, and interrupted-session restoration.
- [ ] Verify old-row behavior explicitly; native code changes require a rebuild and physical verification.
- [ ] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [ ] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.

## Completion / disposition record

No implementation, PR or new verification recorded yet. Before closing, replace this paragraph with:

- Change summary and commit/PR (or evidence-backed reason for deferral/rejection).
- Executed commands with outcomes and relevant regression evidence.
- Physical-device results where required, including build revision and log references.
- Remaining limitations or follow-up issue links.
