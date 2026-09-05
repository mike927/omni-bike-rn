# A01 — Screen-owned engines stop or double session recording

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Branch / PR | None |
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

- [ ] Mount Home and Training consumers together with real engine behavior; exercise both start origins.
- [ ] Assert one tick per second while Active and zero while Paused, including Back/reentry and repeated Pause/Resume.
- [ ] Assert finish/reset leaves no timer and a stale consumer cleanup cannot stop a later ride.
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
