# A10 — Multiple screens independently own global reconnect policy

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Branch / PR | None |
| Last updated | 2026-09-05 |
| Type | Improvement |
| Category | architecture |
| Severity | Not applicable |
| Priority | P2 — Planned |
| Evidence | Confirmed — static ownership inspection |
| Estimated effort | Medium |

## Dependencies and coordination

A05 may be fixed independently first. Follow the root-owned lifecycle approach from A01.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/features/home/screens/HomeScreen.tsx](<../../../../src/features/home/screens/HomeScreen.tsx>) — audit lines/section 35.
- [src/features/settings/screens/SettingsScreen.tsx](<../../../../src/features/settings/screens/SettingsScreen.tsx>) — audit lines/section 54.
- [src/features/training/screens/TrainingDashboardScreen.tsx](<../../../../src/features/training/screens/TrainingDashboardScreen.tsx>) — audit lines/section 46.
- [src/features/gear/hooks/useAutoReconnect.ts](<../../../../src/features/gear/hooks/useAutoReconnect.ts>) — audit lines/section 47–57.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Every mounted consumer owns retry timers, counters, and attempt references against global connection state. Understanding one reconnect cycle requires knowing which screens remain mounted.

## Triggering scenario

Navigate among Home, Training and Settings while a reconnect cycle is active; several consumers may remain mounted with separate local budgets and cleanup.

## Expected versus observed / evidence

Shared connection guards limit concurrent work, so the audit does not establish that every reconnect fails. The demonstrated maintenance problem is fragmented global lifecycle ownership and navigation-dependent reasoning/testing.



## Impact and triage

Improvement/P2, no demonstrated defect severity: a single owner gives retry policy and teardown clear locality and makes one retry cycle testable without navigation history.

## Smallest sound correction or improvement

Mount one reconnect lifecycle owner through the existing initialization seam. Consumer hooks expose state and retry commands without owning global effects. Follow the local useWatchHr/useWatchHrControls pattern; no generic framework is needed.

## Acceptance criteria and verification

- [ ] Mount multiple consumers and prove exactly one global retry budget/cycle.
- [ ] Unmount one consumer mid-cycle without restarting or cancelling global work.
- [ ] Preserve bounded retries, foreground handling, explicit Retry and auto-reconnect suppression.
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
