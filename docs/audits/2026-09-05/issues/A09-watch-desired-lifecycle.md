# A09 — Watch asynchronous transitions discard newer lifecycle intent

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
| Evidence | Confirmed — static callback-ordering defects; physical frequency unmeasured |
| Estimated effort | Medium |

## Dependencies and coordination

Independent Watch-side fix; coordinate the intended pause semantics with A06.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [ios/OmniBikeWatch Watch App/WorkoutManager.swift](<../../../../ios/OmniBikeWatch Watch App/WorkoutManager.swift>) — audit lines/section 203–215, 223–237, 298–336, 554–569.
- [modules/watch-connectivity/ios/WatchConnectivityModule.swift](<../../../../modules/watch-connectivity/ios/WatchConnectivityModule.swift>) — audit lines/section 282–297.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Pending Watch work is guarded by current state/in-flight flags without retaining the latest desired lifecycle intent. Two callback orderings expose this shared ownership problem.

## Triggering scenario

1. Pause starts an HK transition; Resume arrives before the callback and is discarded by pauseResumeInFlight.
2. Start awaits authorization; Stop arrives while session is nil; authorization then succeeds.

## Expected versus observed / evidence

In sequence 1 the paused callback clears the guard without applying Resume, leaving Watch paused while the phone is Active. In sequence 2 authorization starts a Watch workout after the ride ended. Expected: the latest valid phone intent wins. These are static traces, not executed native reproductions.



## Impact and triage

Medium/P2: affected ordering can stop Watch HR/calories or leave an orphan workout. Timing requirements limit likelihood and manual recovery generally exists.

## Smallest sound correction or improvement

Retain desired lifecycle state and a start generation. Reconcile running/paused intent after transition completion. Stop invalidates pending authorization/start even without an existing session. Keep duplicate-transition protection rather than simply deleting the interlock.

## Acceptance criteria and verification

- [ ] Control native callbacks for pause → resume → paused callback and the reverse sequence.
- [ ] Delay authorization, issue Stop, then succeed authorization; no workout may start.
- [ ] Cover duplicate starts, a genuinely later start, Stop superseding pending transitions, and delayed transport delivery on devices.
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
