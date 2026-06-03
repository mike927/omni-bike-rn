# Background HR Streaming — Feasibility & Limits

**Status:** gap **accepted as-is** (2026-05-28). This doc records *what is achievable* for
live HR from the watch and *what is not* — and **why** — so we don't re-investigate or chase
fixes that can't work.

Companion docs: transport mechanics in
[`watch-iphone-communication.md`](watch-iphone-communication.md) (T1–T5); the
foreground-recovery workstream in
[`../superpowers/plans/2026-05-26-watch-background-hr-sync.md`](../superpowers/plans/2026-05-26-watch-background-hr-sync.md).

---

## 1. The question

The watch is a **pure HR sensor**; the iPhone is the primary screen. So: *can we get reliable,
near-real-time HR on the phone while the watch app is in the **background** (user looking at the
watch face / the workout Live-Activity card), not at the OmniBike app?*

**Answer: no — not below ~minute-scale gaps. This is an OS limit, not a bug.** Reliable ~5 s HR
requires the watch app to be **frontmost (including Always-On dimmed)**.

---

## 2. Ground truth (from device logs)

`Documents/wc.log` on the iPhone, real rides:

| Watch app state | HR cadence reaching the phone | User-visible result |
|---|---|---|
| **Frontmost / Always-On dimmed** (`scenePhase` active/inactive) | ~every **5 s** | HR shows fine |
| **True background** (on the watch face / Live-Activity card) | gaps of **30 s → 3 min → 5 min** (observed 21 s, 37 s, 176 s, 311 s) | HR tile blanks to **"No signal"** |

The phone blanks the value after `HR_NO_SIGNAL_TIMEOUT_MS = 15_000` ms
(`src/services/hr/hrSource.ts`, `resolveHrReading`). Every true-background gap exceeds 15 s, so
the number reads **"No signal"** even though the session is alive and availability stays **"Ready"**.

Whole-log channel tally (one multi-ride session): **T5 mirrored 337**, **T4 appContext 276**,
**T2 sendMessage(hr) only 26**. T2 is a minor contributor (it only sneaks through during brief
`reachable=true` flaps); the real stream is **T5**, with **T4** as a coalesced fallback.

---

## 3. Why — the OS "suspend-and-batch" model

An active `HKWorkoutSession` + the `workout-processing` background mode keeps the **sensor
collecting into HealthKit**, but it does **not** keep `HKLiveWorkoutBuilder.didCollectDataOf`
firing in near-real-time once the app is **not frontmost**. watchOS suspends the app's process
and **batches** HR samples, flushing them on wrist-raise / foreground. Wrist-down (screen off)
reduces HR *sampling* further; battery-saver modes drop it to ~1/min.

**It's collection-side, not transport-side** — proven without the watch's own log: **T5 is not
coalesced** (every `sendToRemoteWorkoutSession` is delivered discretely), yet T5 itself shows
3–5 min gaps in true background. A non-coalesced channel can only be that sparse if the watch
**didn't call it** — and it only calls it from a builder callback. So the builder is firing
every few minutes → the *production* of samples is throttled, and no transport change can outrun
a source that isn't producing.

> **Refines** the note in `watch-iphone-communication.md` §3a: T5 keeps delivering while the
> screen is merely **dimmed** (app still frontmost). In **true background** (app left for the
> watch face), T5's *source* — the builder — is suspend-and-batched, so T5 goes sparse too.

---

## 4. Not feasible — ruled out (don't re-try)

| Approach | Verdict | Why |
|---|---|---|
| `HKAnchoredObjectQuery` + `enableBackgroundDelivery` | ❌ slower, not faster | Background HR delivery is throttled to minutes/hourly outside a foreground workout. Already tried — see `WorkoutManager.swift` comment (~L62-69): its handler froze the widget when dimmed, which is why we use `HKLiveWorkoutBuilder`. |
| Phone-side `HKAnchoredObjectQuery` on synced HR | ❌ | Watch→iPhone HealthKit store sync is **not real-time** and has no API to speed it up; it's system-scheduled and batched. |
| `WKExtendedRuntimeSession` | ❌ | A workout app already has the strongest background allowance via `workout-processing`. ERS grants no extra HR cadence; surplus background CPU just gets you suspended. |
| Release / TestFlight build instead of Expo dev client | ❌ | The watch app is **native Swift** (no Expo/JS in that path). The OS limit is identical for Debug/Release/TestFlight. Dev-client churn only makes the *phone* side look noisier (T2/reachability flaps), which isn't what causes "No signal". |
| Any watchOS 26 API for sub-minute background HR | ❌ | None documented. Always-On / Smart-Stack Live Activities don't change background data cadence. |
| A different WC transport / sending "harder" | ❌ | T5 is already the fastest background path. The bottleneck is sample *production*, upstream of all transports. |

---

## 5. Feasible — the actual levers

| Lever | What it achieves | In our control? | Tradeoff |
|---|---|---|---|
| **Honest stale-HR UX** — last value + "updated Xs ago" / stale chip instead of a hard blank | Experience stops looking broken; continuity shown | ✅ fully (JS only) | Doesn't make data live; must clearly mark stale (training context) |
| **Keep-watch-app-foreground nudge** (rely on Always-On; hint "keep the OmniBike screen up") | Restores ~5 s — frontmost/AOD already works | ✅ | Relies on user cooperation; navigating away still degrades |
| **Auto-fallback to bike/BLE HR during watch gaps** | Genuinely *live* HR from another sensor | ✅ medium | Source-switching mid-session fights the session-lock design; needs a 2nd source present |
| **BLE chest/arm strap as primary** (already a supported `bluetooth` source) | Rock-solid ~1 Hz regardless of watch screen | ✅ | Extra hardware; not "watch-only" |

**Architecture note.** The phone-primary + watch-as-background-sensor model is exactly the case
watchOS power-management penalizes (normally the *watch* is the foreground workout device). The
only ways to truly beat the gap are "keep the watch app foreground" or "use a BLE strap."

---

## 6. Decision (2026-05-28)

**Gap accepted for now.** No native or UX change taken. If/when we revisit, the ranked path is
§5 #1 + #2 (honest stale UX + keep-foreground nudge), with a BLE strap (#4) as the bulletproof
option. The mid-ride foreground-recovery bug (`startWatchApp` while the phone app is backgrounded)
is tracked separately as sub-project 8 / the watch-background-hr-sync plan.

---

## 7. References

**Code:** `ios/OmniBikeWatch Watch App/WorkoutManager.swift` (builder pipe, `sendHrToPhone`,
L62-69 comment) · `modules/watch-connectivity/ios/WatchConnectivityModule.swift` (receive side,
T5 `didReceiveDataFromRemoteWorkoutSession`) · `src/services/hr/hrSource.ts`
(`HR_NO_SIGNAL_TIMEOUT_MS`, `resolveHrReading`).

**Apple:** [Build a multi-device workout app (WWDC23 10023)](https://developer.apple.com/videos/play/wwdc2023/10023/)
· [`startMirroringToCompanionDevice`](https://developer.apple.com/documentation/healthkit/hkworkoutsession/startmirroringtocompaniondevice(completion:))
· [`sendToRemoteWorkoutSession`](https://developer.apple.com/documentation/healthkit/hkworkoutsession/sendtoremoteworkoutsession(data:completion:))
· [Using extended runtime sessions](https://developer.apple.com/documentation/watchkit/using-extended-runtime-sessions)
· HealthKit cross-device sync is not real-time ([forum 774953](https://developer.apple.com/forums/thread/774953))
· Background HR is suspend-and-batch ([forum 9880](https://developer.apple.com/forums/thread/9880),
[16102](https://developer.apple.com/forums/thread/16102)).
