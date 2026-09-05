# A05 — BLE disconnects leave stale state and block HR reconnection

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | In progress |
| Owner | automated remediation agent |
| Branch / PR | `fix/a05-ble-disconnect-state` / https://github.com/mike927/omni-bike-rn/pull/112 |
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

- [x] Emit native disconnect after connecting a strap; assert readiness changes and exactly one reconnect cycle begins.
- [x] Emit a delayed disconnect from a replaced adapter and ensure the new adapter survives.
- [ ] Verify deliberate disconnect cleans subscriptions and respects suppression; confirm out-of-range recovery on hardware. Subscription cleanup is Jest-covered, and so is cross-role suppression: a drop arriving *during* a deliberate teardown is proven inert when it lands on the other role inside `disconnectAllDeviceConnections`, end to end against a fixture whose `remove()` really deregisters. For the session teardown's own Stop/Reset window, the direct Jest proof is narrower: it shows the observers are disarmed before the teardown starts waiting on the bike, not an end-to-end run of a drop actually landing inside that window. Given the fixture's `remove()` semantics the first implies the second, so the cover is real, but it is an implication, not a directly exercised case; the ticket previously stated this more strongly than the test supports. What remains is genuinely device-only, not merely unwritten, and the second item below is load-bearing rather than a formality: a probe against a fixture whose `remove()` is a no-op reproduces the full original defect even on today's shipped code, because the adapter identity guard alone does not close that window, so the hardware run is the only thing that closes it. The five items: that ble-plx really raises `onDeviceDisconnected` for a power-off or out-of-range peripheral rather than only for a locally issued `cancelDeviceConnection`; that `Subscription.remove()` really deregisters natively, which the entire fix depends on and every Jest proof only assumes by fixture; that a returned strap re-dials inside the `[0, 3000, 5000]` ms probe budget; that ending a ride normally produces no spurious reconnect on real hardware; and that a bike power-off mid-ride freezes the ride exactly once now that the observer fires immediately instead of after the 5 s telemetry watchdog. The iOS Simulator cannot do BLE, so this box stays unticked until that run is recorded.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: Claimed on `fix/a05-ble-disconnect-state`. Added a native BLE disconnection observer at the connection owner (`useDeviceConnection`), identity-guarded per adapter and disposed before every deliberate disconnect. Jest acceptance covered; status stays In progress pending on-device out-of-range verification.
- 2026-09-05: Review round 1. Closed the cross-role disposal gap the review found: observer disposal was per role, so a drop arriving during a deliberate teardown lifted the suppression that teardown had just applied. Both roles are now disarmed up front, in `disconnectAllDeviceConnections` and again at the top of the session teardown's suppressed window. Test-quality follow-ups from the same review also landed. Status stays In progress: the residual is device-only.
- 2026-09-05: Fix round 2. The round 1 re-review confirmed all ten prior findings addressed but found the round itself had introduced problems: an `AGENTS.md` bullet overstated the up-front disarm as universal (it applies only to the two all-role teardowns, not the single-role ones), the same bullet's "sample silence never implies disconnection" claim did not hold app-wide, and a throw between the up-front disarm and the second role's teardown in `disconnectAllDeviceConnections` could leave that role live and permanently unobserved. All three are fixed: `AGENTS.md` now states the all-role/single-role split and scopes the sample-silence rule; `disconnectAllDeviceConnections` runs the HR half in a `finally` so it always tears down even if the bike half throws, covered by a new mutation-backed test. This section's wording was also softened per the re-review, and device-only item 2 is now called out as load-bearing. Status stays In progress: the residual is unchanged and device-only.
- 2026-09-05: cross-link. The device-only checks this ticket leaves outstanding are folded into the consolidated device pass at [`docs/audits/2026-09-05/device-verification.md`](../device-verification.md), produced under [A11](A11-native-upgrade-verification.md) and run once against build `c19673e` for all of A01 to A10. Nothing here changes until that run is recorded.

## Completion / disposition record

**Change summary.** The connection owner (`src/features/training/hooks/useDeviceConnection.ts`) now registers
`bleManager.onDeviceDisconnected` for each connected role at the moment it stores the adapter, so a peripheral that
loses power or leaves range is reported by the transport instead of being inferred from sample silence:

- `observeBikeDisconnect` / `observeHrDisconnect` register the observer next to `setBikeAdapter` / `setHrAdapter`.
  Each listener is identity-guarded against the *adapter instance* it was registered for, so a late event from a
  replaced adapter cannot tear down the adapter that replaced it.
- The bike path reuses `handleUnexpectedBikeDisconnect`; the HR path gained the matching
  `handleUnexpectedHrDisconnect`. Both release the data subscription and the observer by whether they exist
  (the `AGENTS.md` idempotent-teardown principle), clear the connection state, and hand the device back to the
  reconnect cycle with `autoReconnectSuppressed = false`.
- Every deliberate disconnect (`disconnectBikeConnectionInternal`, `disconnectHrConnectionInternal`,
  `handleUnexpectedBikeDisconnect`) disposes its observer *before* cancelling the connection, because cancelling
  raises the same native event: without that ordering a teardown would report itself as an unexpected drop and lift
  the suppression it had just applied.
- New `useDeviceConnectionStore.clearHrTransport()` drops the BLE HR adapter and its readings while leaving
  `activeHrSource` in place. An out-of-range strap is not a change of HR source, so the ride keeps its per-session
  lock and the dashboard keeps reporting the locked source (the documented in-workout rule in
  `src/services/hr/hrStatus.ts`). `connectHr`'s pre-connect cleanup uses the same transport-only path
  (`keepActiveHrSource`), so a reconnect probe does not destroy the lock on its way to restoring it. Deliberate
  disconnects still release the lock through `clearHrConnection()`.

The effective HR source continues to resolve only through `hrSource.ts` / `useEffectiveHrSource.ts`; no code reads
the raw stored `primaryHrSource`, and Watch candidacy is untouched.

**Commit / PR.** Branch `fix/a05-ble-disconnect-state`, PR https://github.com/mike927/omni-bike-rn/pull/112.

**Executed commands.**

- `npx jest src/features/training/hooks/__tests__/useDeviceConnection.test.ts src/features/gear/hooks/__tests__/bleDisconnectRecovery.test.ts` before the fix: 8 failed (the new reproductions), 16 passed.
- `npm run ci:gate` (lint + typecheck + `jest --ci --runInBand`) after the fix: lint clean at `--max-warnings 0`, `tsc --noEmit` clean, **112 suites / 1080 tests passed**.
- Mutation check (fix deleted, tests rerun, then restored), each mutation caught by its intended test:
  - observers not registered at all: 8 failures.
  - adapter identity guard removed: `ignores a late native disconnect from a replaced HR adapter` fails.
  - observer left alive through a deliberate disconnect: `disposes the native disconnect observers on a deliberate disconnect and keeps suppression` fails.
  - `clearHrTransport` swapped for `clearHrConnection` on the unexpected path, and `keepActiveHrSource` dropped from the reconnect probe: `keeps the per-session HR lock when the strap drops off the air mid-ride` fails in both cases.

**Review round 1.** The independent review returned CHANGES_REQUIRED: observers were released only inside their own
role's teardown, so a native drop arriving *during* a deliberate teardown was still handled as an unexpected one and
lifted the suppression that teardown had just applied. A probe reproduced it end to end after a ride-end
`disconnectAll({ suppressAutoReconnect: true })`: `hrConnect` dialled twice, `hrAdapter` non-null,
`hrAutoReconnectSuppressed` false, `hrReconnectState` `connected`. The same class of window sat one layer up, where the
session teardown holds `disconnectPauseSuppressed` through the pending FTMS Stop and the fire-and-forget Reset.

Both are closed by disarming every role up front rather than per role: `releaseDeviceDisconnectObservers()` runs first
in `disconnectAllDeviceConnections`, and again as the first act inside `runResetSessionAndConnections`'s suppressed
window. Releasing by existence keeps it idempotent, so the per-role disposal that still guards a single
`disconnectBike()` / `disconnectHr()` is unchanged. Post-fix the same probe reports `hrConnect` dialled once,
`hrAdapter` null, `hrAutoReconnectSuppressed` true, `hrReconnectState` `disconnected`. The round also removed an
unnecessary `onDeviceDisconnected` line from `src/__mocks__/react-native-ble-plx.ts`, gave the test fixtures a real
`remove()` and per-device routing, and added cover for the bike identity guard, for observer release inside both
unexpected handlers, and for the unexpected HR handler's own `adapter.disconnect()`. `AGENTS.md` gained the transport
observer rule and its Session-ownership bullet was amended to match. `npm run ci:gate` after the round: lint clean at
`--max-warnings 0`, `tsc --noEmit` clean, **112 suites / 1086 tests passed**.

**Physical-device results.** None yet. The iOS Simulator cannot do BLE (`AGENTS.md`, Runtime), so out-of-range
recovery has to be confirmed on hardware: connect a saved strap and the bike, power the strap off (or walk it out of
range) both mid-ride and while idle, and confirm the device chip leaves Ready, that one reconnect cycle runs, that the
strap recovers when it comes back, and that ending a ride normally still leaves both devices disconnected without a
spurious reconnect. Status therefore stays **In progress** until that run is recorded.

**Remaining limitations.**

- Reconnect policy is still mounted per screen (Home, Settings, Training dashboard), so the automatic cycle only runs
  while one of those screens is mounted. Consolidating that ownership is [A10](A10-reconnect-lifecycle-ownership.md);
  this ticket deliberately left it alone.
- `StandardHrAdapter`'s characteristic-monitor error handler still swallows disconnect-shaped errors. That is now
  correct by design: the transport reports disconnection natively, and sample silence is not treated as a
  disconnection.
