# A05 — BLE disconnects leave stale state and block HR reconnection

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
| Evidence | Confirmed — static adapter-to-reconnect trace; hardware frequency unmeasured |
| Estimated effort | Medium |

## Dependencies and coordination

Can be fixed before A10; preserve identity-guarded, idempotent teardown.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/services/ble/StandardHrAdapter.ts](<../../../../src/services/ble/StandardHrAdapter.ts>) — audit lines/section 44–54.
- [src/features/training/hooks/useDeviceConnection.ts](<../../../../src/features/training/hooks/useDeviceConnection.ts>) — audit lines/section 237–239.
- [src/features/gear/hooks/useAutoReconnect.ts](<../../../../src/features/gear/hooks/useAutoReconnect.ts>) — audit lines/section 283–290, 364–380, 423–439.
- [src/services/hr/hrStatus.ts](<../../../../src/services/hr/hrStatus.ts>) — audit lines/section 73–74.
- [src/services/ble/__tests__/StandardHrAdapter.test.ts](<../../../../src/services/ble/__tests__/StandardHrAdapter.test.ts>) — audit lines/section 194–196.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

HR monitor errors do not notify the connection owner; no native disconnection observer exists in src at the audit baseline. The adapter remains non-null, and connection/readiness/retry logic treats its existence as proof of a live connection.

## Triggering scenario

Connect a saved strap, then power it off or move it out of BLE range.

## Expected versus observed / evidence

Idle readiness remains connected; automatic reconnect requires a null adapter and does not run. Explicit Retry also treats the stale adapter as connected. Active HR correctly expires after its freshness timeout, but reconnection remains blocked. Bike idle/paused readiness has a related gap because the bike telemetry watchdog runs only while Active.

`onDeviceDisconnected` exists in installed BLE PLX 3.5.1 (`node_modules/react-native-ble-plx/src/BleManager.js`). See [official API documentation](https://dotintent.github.io/react-native-ble-plx/#blemanagerondevicedisconnected).

## Impact and triage

Medium/P1: ordinary sensor loss disables selected HR until teardown/restart or re-pairing. Other ride data can still record.

## Smallest sound correction or improvement

Observe native disconnection at the connection owner. Clear only the matching adapter/readings, update reconnect state, and dispose the observer on deliberate teardown/replacement. Do not infer transport disconnection from HR sample silence alone.

## Acceptance criteria and verification

- [ ] Emit native disconnect after connecting a strap; assert readiness changes and exactly one reconnect cycle begins.
- [ ] Emit a delayed disconnect from a replaced adapter and ensure the new adapter survives.
- [ ] Verify deliberate disconnect cleans subscriptions and respects suppression; confirm out-of-range recovery on hardware.
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
