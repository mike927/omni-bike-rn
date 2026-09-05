# Unvalidated audit hypotheses

[Audit index](README.md) · Baseline `965cbec` · 2026-09-05

These are **Needs validation**, not confirmed bugs. They remain exploratory Future Considerations in the roadmap. Follow the index status/claim workflow per hypothesis; promote a supported defect into its own triaged issue and link the evidence. Missing coverage alone does not establish a bug.

## H01 — Delayed Watch commands may affect a later ride

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Last updated | 2026-09-05 |
| Evidence | Needs validation |

Phone/Watch commands lack ride identity. A command queued for a previous ride may be delivered during a later ride. Static absence of correlation does not establish the actual cross-transport delivery sequence.

Starting points: [phone command sender](../../../modules/watch-connectivity/ios/WatchConnectivityModule.swift), [Watch command receiver](<../../../ios/OmniBikeWatch Watch App/WorkoutManager.swift>), [remote-control hook](../../../src/features/training/hooks/useWatchRemoteControl.ts).

Validation: record/hold a previous-ride pause or stop, begin a later ride, then replay delivery through the actual command handlers. Establish whether it changes the new ride and whether existing lifecycle guards prevent the sequence. Confirm relevant delivery assumptions on hardware before claiming native reproduction.

Disposition / work log: Imported from audit; no validation performed beyond static inspection.

## H02 — Distance fallback may lose progress after reconnection

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Last updated | 2026-09-05 |
| Evidence | Needs validation |

Ordinary omitted FTMS distance fields do not prove this bug: the same adapter retains its previous distance. A new/reconnected adapter resets metrics. If recording resumes with speed-only ticks before a non-reset bike distance counter arrives, accumulator rebasing may discard the fallback contribution.

Starting points: [Zipro adapter](../../../src/services/ble/ZiproRaveAdapter.ts) (audit lines 140, 171–177), [distance accumulator](../../../src/services/training/sessionAccumulator.ts) (audit lines 27–48), [restore input](../../../src/store/trainingSessionStore.ts).

Validation: construct a concrete reconnect → resume → speed-only ticks → original hardware counter sequence through the connection owner and engine. Establish whether total distance decreases or loses progress. Do not present ordinary packet omission as that reproduction. Coordinate with A07 if a defect is confirmed.

Disposition / work log: Imported from audit; no end-to-end reconnect reproduction performed.
