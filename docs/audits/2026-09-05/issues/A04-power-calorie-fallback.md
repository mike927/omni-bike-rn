# A04 — Power calorie fallback incorrectly requires live HR

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

- [ ] Cover no HR, stale Watch HR, missing profile, and simultaneous power/bike energy.
- [ ] Distinguish absent power from valid zero power and verify fallback priority.
- [ ] Replace the existing test encoding zero calories with valid power; preserve source-switch rebasing tests.
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
