# A07 — TCX exports raw bike distance counters

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

- [ ] Trace reducer → persistence → serializer for initial offsets, resets, restored rides, and speed-only distance.
- [ ] Assert monotonic workout-relative trackpoints and agreement with final distance.
- [ ] Test the explicit legacy-row fallback and document any approximation.
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
