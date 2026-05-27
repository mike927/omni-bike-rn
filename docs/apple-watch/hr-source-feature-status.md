# HR Source & Device Status — Feature Completion Tracker

**Branch:** `feat/watch-hr-source-visibility`  ·  **Updated:** 2026-05-27

One place to see the whole feature: what's done, what's open, what to validate, and the
bar for "done." The feature = *let the user pick a primary HR source (Apple Watch / Bluetooth
strap / bike pulse), lock it for the session, and show one honest status per device everywhere.*

---

## 1. Orientation — sub-projects & status

| # | Sub-project | Spec / Plan | Status |
|---|---|---|---|
| 1 | HR source domain: per-source freshness, locked `activeHrSource`, no fallback | `2026-05-25-primary-hr-source` | ✅ done |
| 2 | Primary HR source selector (Settings) | `2026-05-25-primary-hr-source` | ✅ done |
| 3 | Training dashboard HR tile | `2026-05-22-hr-source-tile` | ✅ done |
| 4 | Home read-only gear cards | `2026-05-22-home-readonly-gear-cards` | ✅ done |
| 5 | Pause/resume propagation to the watch | (in visibility plan) | ✅ done |
| 6 | Watch availability → **companion-presence, 2-state** (`connected`/`unavailable`) | `2026-05-26-watch-availability-two-state` | ✅ done + reviewed · ⏳ on-device unverified |
| 7 | **Unified `DeviceStatus` vocabulary** + completion (paused/connecting states, bike gating) | `2026-05-27-unify-device-status-labels` | ✅ done — §2 gaps resolved (I1–I3 done, I4–I5 decided) |
| 8 | **Background HR sync** (instant recovery on foreground mid-ride) | `2026-05-26-watch-background-hr-sync` | ⏸️ **deferred to its own branch** (per §4.4) — on-device diagnosis task, spec+plan ready |

Canonical vocabulary (`src/services/status/deviceStatus.ts`): `notSetUp` "Not set up" ·
`connecting` "Connecting..." · `ready` "Ready" · `noSignal` "No signal" · `unavailable`
"Unavailable" · `off` "Off". Reference: `docs/apple-watch/watch-iphone-communication.md`.

---

## 2. Open issues — decisions & design (2026-05-27)

Decisions made under the active goal: reliable/coherent, no patches, clean structure.

- [x] **I1 · Bike-pulse always "Ready"** even when the bike isn't connected
  (`hrStatus.ts:78`). ✅ **DONE** (commit `0e19173`, reviewed). Gate bike on its live connection: `hrSourceIdleReadiness`
  gains a `bikeConnected` input; bike → `ready` iff `bikeConnected`, else `unavailable` —
  matching the watch/BLE gating. The idle bike-pulse readiness then reflects the FTMS link.
- [x] **I2 · No "Paused" state** → a paused ride reads "No signal". ✅ **DONE** (commit `0e19173`). Add a `paused`
  member to the canonical `DeviceStatus` (label "Paused"). In-workout, `phase === Paused`
  resolves to `paused` (overrides freshness). Feasible: pause is already propagated to the watch
  (`pauseMirroredWorkout`), so HR genuinely stops — "Paused" is the honest readout.
- [x] **I3 · No watch wake / "Connecting…" feedback** at ride start. ✅ **DONE** (commit `0e19173`). Extend `resolveHrReading` with `awaitingFirstReading` (no sample seen
  yet this session: watch/BLE = `lastSampleAtMs === null`, bike = `bikeHeartRate === null`).
  In-workout status becomes: `paused` → `ready` (live) → `connecting` (awaiting first sample
  **and** within `HR_CONNECTING_GRACE_SECONDS = 30`) → `noSignal` (had-then-lost, or grace
  elapsed with nothing). Reuses the existing `connecting` label. Feasible with real signals
  (we know when `connect()`/`startWatchApp` runs and when the first sample lands; `noSignal`
  after the grace is the honest failure surfacing).
- [x] **I4 · "Ready" overloaded** (idle "usable" vs mid-ride "live"). ❌ **WON'T-DO.** Keep a
  single `ready` label. One-label-per-state is the coherent architecture; context-dependent
  wording ("Live" mid-ride) would break it and add complexity for little gain. The live BPM
  number already conveys streaming.
- [x] **I5 · "Connected"/"Not connected" for Strava + Apple Health** (`SettingsScreen.tsx:289,374`).
  ❌ **WON'T-DO.** Those are **account links** (OAuth/authorization), a different domain from
  device connectivity — "Connected" is correct there. Out of scope for the device-status vocabulary.

**In-workout status state machine (the design of record):**
```
PAUSED      if phase === Paused
READY       else if reading.live
CONNECTING  else if reading.awaitingFirstReading && elapsedSeconds <= HR_CONNECTING_GRACE_SECONDS
NO_SIGNAL   otherwise
```
**Idle readiness:** watch → connected?ready:unavailable · bluetooth → hrConnected?ready:unavailable
· bike → **bikeConnected?ready:unavailable** (I1).

---

## 3. To validate

**Automated**
- [x] Full suite green — **70 suites / 756 tests pass** (commit `0e19173`, +16 new status tests).
- [x] `npx tsc --noEmit` + `npm run lint` clean.

**On-device** (via `manual-test-handoff` skill; JS-only changes → Metro reload)
- [ ] **Availability stable:** watch paired+installed → tile **"Ready"**, stays Ready while the
  idle watch app suspends (no flap). *(criterion 7 of the availability spec)*
- [ ] **Availability flips:** uninstall the watch app (or unpair) → tile **"Unavailable"**;
  reinstall → back to **"Ready"**. Log-proven via `emitCompanionState available=…`. *(criterion 8)*
- [ ] **Lock / no-fallback:** start a watch-primary ride → HR streams; kill watch app →
  "No signal" after ~15 s, never silently falls back to bike.
- [ ] **Pause/resume:** pause → watch timer stops; resume → HR resumes. (See I2 re: label.)
- [ ] **Background HR (sub-project 8):** background the app mid-ride → on foreground, HR is live
  immediately (no lingering "No signal"); a real kill still → "No signal".

---

### Live-log findings (2026-05-27, from Metro `[WC-JS]` during user testing)

- ✅ **Availability stable = "Ready"** — `event companion available=true paired=true installed=true`
  fires repeatedly, never `available=false`. Criterion 7 log-confirmed (companion presence is steady).
- ✅ **Pause propagates** — `phase Active→Paused — sending pauseMirroredWorkout` observed.
- 🟡 **Background wake fails (→ sub-project 8):** during a backgrounded ride the mid-ride
  reachability-retry calls `startWatchApp`, which throws
  `Error: Cannot start watch app when phone app is in background` (caught + logged by `useWatchHr`).
  Pre-existing (the documented wake-on-start limit), NOT a regression from I1–I3. **Lead for the
  background-sync task:** the retry should not attempt `startWatchApp` while the iPhone app is
  backgrounded (it can't succeed); a backgrounded ride with a running session should rely on the
  T5 mirrored stream, not a re-wake. Fix + validate under sub-project 8 (needs a controlled repro).
- ⏳ Tile labels for I1/I2/I3 (bike gating / "Connecting…" / "Paused") are visual — still need the
  user's eyes (handoff in chat).

## 4. Completion criteria (definition of done)

The feature is **done** when:
1. All §3 automated checks pass.
2. All §3 on-device checks pass (availability stable + flips; lock/no-fallback; pause/resume).
3. Every §2 issue has an explicit decision; chosen fixes are implemented + reviewed
   (subagent-driven-development) and re-validated.
4. **Background HR sync (sub-project 8)** is either completed *or* explicitly deferred to its own
   branch (it's a self-contained on-device diagnosis task — fair to split out). → ⏸️ **deferred** (2026-05-27).
5. Docs aligned: `watch-iphone-communication.md` and the availability spec reflect "Ready"
   wording and any I1–I3 changes; this tracker's boxes are checked.

---

## 5. Explicitly out of scope / deferred

- Background HR *value* recovery is sub-project 8; everything else here treats it as separate.
- Reverting to reachability/contact-based availability — rejected (flaps); companion-presence stays.
- No native changes for §2 issues (all JS-only) except possibly I3 (wake feedback).
