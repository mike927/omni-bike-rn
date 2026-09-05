# A10 — Multiple screens independently own global reconnect policy

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | In progress |
| Owner | automated remediation agent |
| Branch / PR | `chore/a10-reconnect-lifecycle-ownership` / https://github.com/mike927/omni-bike-rn/pull/117 |
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

- [x] Mount multiple consumers and prove exactly one global retry budget/cycle.
- [x] Unmount one consumer mid-cycle without restarting or cancelling global work.
- [x] Preserve bounded retries, foreground handling, explicit Retry and auto-reconnect suppression.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.
- [ ] Physical-device confirmation that a real drop still recovers on the same cadence (iOS Simulator cannot do BLE, so no Jest run or Simulator build can settle this).

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: claimed and implemented on `chore/a10-reconnect-lifecycle-ownership`. Characterized the current behaviour first (`reconnectOwnership.test.ts` written against the pre-change code: with 4 screens mounted the bike spent 5 probes where the policy allows 3 by +3 s, an unmount mid-cycle left an off-cadence probe behind, and a screen mounting mid-cycle dialled an extra one). Then moved the timers, counters and in-flight attempt state into `src/features/gear/reconnectController.ts`, added the root-owned `useAutoReconnectLifecycle` (mounted from `useAppInitialization`), and reduced `useAutoReconnect` to an effect-free consumer. Screens are unchanged. `npm run ci:gate` green. Status stays In progress: the one outstanding item is a physical-device confirmation, which no Jest run or Simulator build can give.

## Completion / disposition record

**Change summary.** Reconnect policy now has one owner, following the A01 shape. The probe budget (3 probes: immediate, +3 s, +5 s), the retry timers, the attempt counters and the in-flight attempt bookkeeping live in `src/features/gear/reconnectController.ts` at module scope. `useAutoReconnectLifecycle`, mounted exactly once from `useAppInitialization`, reconciles that policy against the saved-gear store, the connection store and app foreground state. `useAutoReconnect` is now effect-free: it reads the reconnect state the store already publishes and forwards `retryBike` / `retryHr`. Home, Settings and the Training dashboard were not touched, because the consumer API is unchanged. `connectBike` / `connectHr` / `disconnectBike` / `disconnectHr` were lifted to module-scope operations at the connection owner (`connectBikeDevice`, `connectHrDevice`, `disconnectBikeDevice`, `disconnectHrDevice`) so a screen and the reconnect owner share one implementation; the hook callbacks delegate to them. `AGENTS.md` gained a "Reconnect ownership" domain rule. Branch `chore/a10-reconnect-lifecycle-ownership`, PR https://github.com/mike927/omni-bike-rn/pull/117.

**Behaviour preserved, and how it was pinned.** The refactor changes ownership, not policy. Before moving anything, the current behaviour was locked down by the existing suites (`useAutoReconnect.test.ts`, `bleDisconnectRecovery.test.ts`, `SettingsScreen`/`HomeScreen`/`TrainingDashboardScreen`) plus the new `reconnectOwnership.test.ts`: probe cadence 0 / +3 s / +5 s, a hard budget of 3 probes, transient versus hard failure classification, suppression after a deliberate disconnect and its lifting by an explicit Retry, standing down while backgrounded and resuming on foreground, adopting an adapter connected elsewhere, disowning a device forgotten mid-attempt, and per-role independence (A05's property: a bike drop never dials the strap, and the ride-end teardown still leaves no strap connection behind). Those assertions are unchanged; only the mounting harness in the two gear suites changed, because the owner is now mounted separately from the consumer.

**Deliberate behaviour changes.** (1) One budget and one set of timers however many screens are mounted, and a cycle that neither restarts nor cancels when a screen comes or goes: the point of the ticket. (2) The policy is now mounted from app boot rather than from whichever tab screen happens to be on screen, so it is also live during onboarding; it stays inert there because every path guards on hydrated saved gear. (3) A probe that settles after the owner has been torn down can no longer arm a new timer.

**Commands.**

- `npx jest src/features/gear/hooks/__tests__/reconnectOwnership.test.ts` against the pre-change code: 5 failed, 3 passed (the reproduction).
- `npm run ci:gate` (lint, `tsc --noEmit`, `jest --ci --runInBand`): green, 114 suites, 1138 tests.
- Mutation checks on the new code, all killed by the suite: probe-2 delay 3000 to 2000; probe-3 delay 5000 to 4000; first probe no longer immediate; budget 3 to 4 and 3 to 2; scheduler ignoring suppression; auto-connect ignoring suppression; bike and strap sharing one runtime record; no in-flight guard on a probe; scheduler ignoring background; Retry no longer lifting suppression; owner teardown no longer standing the policy down; scheduler ignoring the stand-down; consumer Retry inert; consumer no longer reading live state; log prefix renamed.

**Remaining limitations.** No physical-device run. The iOS Simulator cannot do BLE, so a real drop-and-recover on the bike and on the strap (cadence, the chip reading one continuous "Connecting...", and Retry after the budget is spent) is still outstanding and is the one unticked acceptance box.
