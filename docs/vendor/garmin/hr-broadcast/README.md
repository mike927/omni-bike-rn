# Garmin HR Broadcast (Watch as BLE HR Sensor)

Sources:
  - https://support.garmin.com/en-US/?faq=lCv1lPCEPI2VeOBq7Q7N17 (general cross-model support article)
  - https://www8.garmin.com/manuals/webhelp/venu/EN-US/GUID-8EC8B7FE-2AC2-46E9-94FC-06416FF1E2ED.html (Venu gen 1 owner's manual — Broadcasting Heart Rate)
  - https://www8.garmin.com/manuals-apac/webhelp/venu/EN-SG/GUID-4CC0ED9D-7C84-4B2E-994D-979121734430-8682.html (Venu gen 1 owner's manual — Wrist Heart Rate)
  - https://forums.garmin.com/sports-fitness/healthandwellness/f/venu/316374/venu-software-update---7-80 (Venu firmware 7.80 release thread, 2022-12-01)
Verified: 2026-04-15
Hardware tested against: Venu gen 1, firmware 7.80, Polish locale
Local copy: none — live web articles, not PDF manuals. Re-verify against the source URLs before trusting instructions.

> This doc describes a cross-model Garmin feature, not a single model.
> It therefore occupies the `hr-broadcast` slug in place of a model slug under `docs/vendor/garmin/`.
> See `docs/README.md` → "Usage" for the cross-model feature slug convention.

## What HR Broadcast is

HR Broadcast is a mode on compatible Garmin watches that causes the watch to advertise the standard Bluetooth Low Energy Heart Rate profile — service `0x180D` and the HR Measurement characteristic `0x2A37` — as a sensor. In this mode the watch looks, from a phone app's perspective, identical to a chest strap: it is a one-way broadcast of the wrist-measured BPM.

The watch does **not** know about or own the workout session while broadcasting. The phone app remains the authoritative session owner: it starts, pauses, finishes, and records the training session. The watch simply supplies the HR stream.

## Compatibility

The feature is available on most modern Garmin wrist-based HR watches. Commonly supported families:

- Fenix 6 and newer
- Forerunner 245 and newer
- Venu 2 and newer
- Vivoactive 4 and newer
- Epix, Instinct 2, Tactix 7, Enduro 2, Marq Gen 2

Garmin's public support matrix at the source URL above is the authoritative list. Do not hard-code family-specific behaviour in app code.

## How to enable it

The exact menu path depends on the watch family. **Do not assume all Garmin watches share the same labels** — the earlier draft of this doc made that mistake and produced copy that did not match Venu gen 1 reality during manual testing.

### Venu gen 1 (verified — firmware 7.80)

Venu gen 1 has **two distinct menu items** under Wrist Heart Rate, and they are not the same thing:

1. Press and hold the **top button** (labeled "B" in the owner's manual — on Venu gen 1 hardware this is the upper-right physical button).
2. **Settings** (gear icon).
3. **Wrist Heart Rate** (Polish: *Pomiar tętna na nadgarstku* / *Czujnik nadgarstkowy*).
4. Choose **one** of:
   - **Broadcast** (Polish: *Transmituj*) — tap this to **enter a dedicated broadcast screen immediately**. The watch then displays a pulsing heart icon with live BPM. The user **must keep this screen active** — pressing Back, waking another screen, or letting the display sleep will stop broadcast. This is the canonical Venu gen 1 limitation and the main reason live Flow A pairing is finicky on this model.
   - **Broadcast In Activity** (Polish: *Transmituj gdy aktywny* / *Transmituj podczas aktywności*) — toggle that enables broadcast automatically whenever a timed activity is running on the watch. Stable workaround for the Back-button limitation above: the user starts an **Indoor Cycling** activity on the watch first, which keeps broadcast active for the full duration of that activity. Recommended for real training sessions on Venu gen 1.

Omni Bike's recovery hint copy (`HR_BROADCAST_HINT` in `GearSetupScreen.tsx`) points users at the dedicated **Broadcast** item because it is faster to test, but the `Broadcast In Activity` + Indoor Cycling combination is what you actually want during a real workout. The in-app `HR_DUAL_RECORDING_HINT` already surfaces the "start Indoor Cycling on the watch first" flow as Flow 2, which dovetails with this workaround on Venu gen 1 specifically.

### Other Venu generations, Fenix, Forerunner, Vivoactive

The general support article lists **"Broadcast Heart Rate"** as a single menu item under Settings → Sensors & Accessories → Wrist Heart Rate on newer models. Exact label and behaviour (single-screen vs toggle-during-activity-only) varies by model and firmware. When in doubt, consult the specific owner's manual PDF for the exact model — Garmin publishes these at `https://www8.garmin.com/manuals/<modelSlug>/`. Do not hard-code a single menu path for all Garmin watches.

### Single source of truth with in-app copy

The above text is mirrored in `GearSetupScreen.tsx` via the `HR_BROADCAST_HINT` module constant. If the button path ever changes, update **both** this doc and that constant in the same commit. They are a single source of truth.

## On-device diagnosis notes (Venu gen 1, firmware 7.80)

Captured during the `feat/garmin-hr-ble-source` manual testing session on 2026-04-15. Recording these here so the next contributor does not have to re-derive them from scratch.

- **`validateHrDevice` returns `missing_hr_service` means the watch is not actually in broadcast mode at the moment of GATT discovery, regardless of what the user thinks.** The filter surfaced the watch in the scan list, but GATT service discovery after connect did not contain `0x180D`. This is the ground-truth test: if `0x180D` is not in the GATT table, the watch is exposing its Garmin proprietary services (companion / Connect bond mode), not the standard HR profile. The advertisement packet alone is not authoritative — only the post-connect GATT table is.
- **Garmin Connect Mobile, when running and paired, holds an active BLE link to the Venu even while backgrounded.** While that link is held, the Venu will not broadcast discoverable HR advertisements to third-party scanners. The user must force-quit Garmin Connect from the iOS app switcher before the Venu becomes visible to Omni Bike — toggling Bluetooth off/on on the iPhone is not a reliable substitute because iOS will re-establish the bond on the next Bluetooth cycle.
- **iOS system-level Bluetooth accessory pairing** (visible at `Settings → Bluetooth → Venu → "Apps allowed to connect"`) is independent from the HR broadcast flow. Forgetting the device from iOS is therefore a last resort that costs the user their Garmin Connect pairing — it is rarely needed. Force-quitting Garmin Connect Mobile in the app switcher is the normal resolution.
- **Real advertisement shapes captured on the author's hardware** (used to tune `isLikelyHrCandidate` — see `src/services/ble/scanFilters.ts`):

  | Device | `serviceUUIDs` | `manufacturerData` Company ID | Filter verdict |
  |---|---|---|---|
  | Sony WH-1000XM5 headphones | `["0000fe03-..."]` etc. | `0x012d` (Sony) | reject ✅ |
  | Marshall STANMORE III [LE] | `null` | none | reject ✅ (was false-positive under old rule) |
  | MacBook Pro | `null` | none | reject ✅ (was false-positive under old rule) |
  | Apple Watch | `null` | none | reject ✅ (was false-positive under old rule) |
  | Samsung 7 Series TV | `null` | `0x0075` (Samsung) | reject ✅ |
  | Pacific Biosciences-branded "net" device | `["0000ff90-...","0000ff80-..."]` | `0x06a8` | reject ✅ |
  | Garmin Venu gen 1 (companion/bond mode) | observed in some passes but variable | — | varies — see below |
  | Garmin Venu gen 1 (broadcast mode) | *not yet captured* | *not yet captured* | TODO |

  The "broadcast mode" row is deliberately left TODO: at the time of writing we had not yet successfully captured advertisement data from a Venu gen 1 that was confirmed to be in the dedicated Broadcast screen (Ścieżka 1 / Path 1 above) with `0x180D` in its post-connect GATT table. Populate this row the next time a contributor has a real Venu gen 1 on the desk in confirmed broadcast mode.

- **Do not trust "empty advertisement means wearable" heuristics.** The earlier revision of `isLikelyHrCandidate` accepted any device that advertised with `serviceUUIDs === null || []`. Real-hardware data proved Apple-family and Samsung devices behave exactly the same way, so the heuristic was a false-positive magnet. The filter now requires positive HR proof (standard HR service in ad, or known wearable vendor Company ID in manufacturer data). See `scanFilters.ts` doc comment for the full rationale.
- **Diagnostic logging pathway.** `src/features/devices/hooks/useBleScanner.ts` contains a `__DEV__`-gated `[ScanDump]` console.warn that dumps every named device's full advertisement (`serviceUUIDs`, `manufacturerData`, decoded Company ID, `rssi`) along with a `REJECTED by clientFilter` marker when the filter drops a candidate. If a future Venu / Polar / COROS user reports "my watch is not visible", ask them to reproduce with `__DEV__ === true` and send the `[ScanDump]` lines. Do not remove this diagnostic until the broadcast mode table above has a populated "Venu broadcast mode" row on real hardware.

## Known limitations

- **Advertisement packet does NOT include `0x180D`.** This is the single biggest gotcha for iOS integration. Garmin watches in HR Broadcast mode (verified on Venu gen 1 with firmware 6.x) expose the standard BLE HR service `0x180D` / characteristic `0x2A37` through GATT *after* connection, but they do **not** include `0x180D` in the advertisement packet. iOS `CBCentralManager.scanForPeripherals(withServices:)` filters strictly by advertised service UUIDs, which means passing `[0x180D]` as a scan filter silently drops every Garmin watch in broadcast mode from scan results even though they are valid BLE HR sensors. Chest straps (e.g. Garmin HRM-Dual) do advertise `0x180D` and are unaffected.

  Omni Bike handles this with a two-layer approach:
  1. **OS scan** is issued with **no service UUID filter** when the gear-setup target is HR (`useGearSetup.ts` → `HR_SCAN_SERVICE_FILTER = null`). The broad scan surfaces the watch.
  2. **Client-side heuristic filter** (`src/services/ble/scanFilters.ts` → `isLikelyHrCandidate`) then removes laptops, TVs, headphones, and phones from the nearby-devices list. A device is shown only if it actively proves it is HR-related: either it advertises `0x180D`, or its manufacturer data starts with a known wearable vendor Company ID (Garmin `0x0087`, Polar `0x006B`, Suunto `0x01E7`, COROS `0x0553`, Amazfit `0x0157`, Wahoo `0x0067`). An earlier version of the filter also accepted "empty advertisement" devices on the theory that Venu gen 1 broadcasts that way; on-device diagnostic logging disproved this — Apple-family devices (MacBook, Apple Watch), Samsung TVs, and Marshall speakers also advertise with null `serviceUUIDs`, so the empty-ad branch was a false-positive magnet and was removed. If a future firmware of a specific broadcast-capable watch advertises completely empty, the fix is to add its vendor's Company ID to the allowlist, not to re-accept empty advertisements.
  3. **Post-connection `validateHrDevice`** remains the authoritative gate for `0x180D` / `0x2A37` presence — if a false-positive slips through the heuristic, it is rejected with the existing `missing_hr_service` error path.

  A regression test in `src/features/gear/hooks/__tests__/useGearSetup.test.ts` asserts that the HR scan path passes `null` + `isLikelyHrCandidate`, and `src/services/ble/__tests__/scanFilters.test.ts` covers the heuristic itself. Do not reintroduce a service-UUID filter for HR.
- **Single subscriber.** Most Garmin watches accept only one concurrent BLE HR subscriber. If Garmin Connect Mobile (or any other app) is already connected to the watch over BLE, Omni Bike will not discover it. Kill Garmin Connect Mobile before pairing.
- **Display sleep.** Some models stop broadcasting (or drop the advertisement) when the watch display sleeps. Keep the display awake during the pairing flow.
- **Broadcast screen must stay active on Venu.** Venu gen 1 exits broadcast mode when the user navigates away from the broadcast-HR screen. Do not press Back between enabling broadcast and tapping `Select` in the app.
- **Auto-exit on some models.** Certain models exit Broadcast HR mode automatically after a timeout or when the watch enters a power-saving state. If reconnect fails mid-session, check the watch.
- **Wrist-HR accuracy.** Wrist HR is inherently less accurate than a chest strap under cold start, rapid HR changes, and high-intensity intervals. This is a hardware limitation, not something the app can correct.

## Why the app remains session owner

HR Broadcast is deliberately one-way: the watch publishes its HR and has no knowledge of what the subscriber is doing with the data. There is no reverse channel for "start workout", "pause", "finish", or "record this BPM into an activity" from the phone to the watch. Anything in that direction requires either the Garmin Mobile SDK for iOS (which does not expose activity control — it is scoped to file transfer, device info, and notifications) or a Garmin Connect IQ companion app running on the watch (Monkey C, store-distributed, per-model testing).

For this feature's scope the app is therefore the authoritative session owner and the watch is a sensor peer, the same role a chest strap plays.

## Workout recording strategies

Users who care about their Garmin ecosystem metrics (Training Load, Body Battery, VO2 Max, Training Status) need to understand a real trade-off here: a natively-recorded watch activity contributes far more to those metrics than a FIT file uploaded to Garmin Connect after the fact. This asymmetry is a Garmin platform decision, not something the app can work around.

There are two realistic flows:

### Flow 1 — HR sensor only

- Enable HR Broadcast on the watch (do **not** start an activity).
- Start training in Omni Bike.
- **Result:** one record. Full bike metrics + HR land in the app → Strava (if connected). The workout does **not** appear in Garmin Connect and does **not** contribute to Training Load / Body Battery / VO2 Max.

Best for users whose Garmin ecosystem engagement is shallow, or who prefer a single authoritative record.

### Flow 2 — Dual recording

- Start an **Indoor Cycling** activity on the watch first.
- Then start training in Omni Bike.
- **Result:** two records. The app records full-fidelity bike data (speed, power, cadence, calories, HR) and uploads to Strava. The watch independently records its own Indoor Cycling activity (wrist HR, time — no power/cadence since the watch is not paired to the bike) and syncs to Garmin Connect with full Training Load / Body Battery / VO2 credit because it is a natively-recorded activity.

Best for users who use Garmin's ecosystem metrics and accept the duplication as the cost of full credit.

### Why there is no one-tap unified flow

A single-tap "record once, land in both places with full credit" flow is **not possible within this feature's scope**. The only technical path is a Garmin Connect IQ companion app written in Monkey C, distributed via Garmin's store, that coordinates start/stop with the phone over the Connect IQ Mobile SDK. That is a separate watch-side codebase with its own toolchain, store review, and per-model testing. It is tracked in `plan.md` Phase 8 as a forward-looking item, not as part of this feature.

A post-hoc alternative — uploading the app-recorded FIT file to Garmin Connect as a second provider adapter alongside Strava — is cleaner than Flow 2 from a UX standpoint (one record, lands in both clouds) but grants only the limited metric credit that Garmin extends to uploaded FIT files. It is tracked in `plan.md` Phase 6.

The in-app dual-recording info block (`HR_DUAL_RECORDING_HINT` in `GearSetupScreen.tsx`) surfaces Flow 1 and Flow 2 to the user at the point they are about to pair an HR source. This doc section is the longer-form reference. Keep the two in sync.

## Code cross-references

- `src/services/ble/StandardHrAdapter.ts` — vendor-agnostic adapter that connects to any device exposing `0x180D` / `0x2A37`. Handles Garmin watches in HR Broadcast mode with zero vendor-specific code.
- `src/services/ble/bleDeviceValidator.ts` — `validateHrDevice(deviceId)` checks the service/characteristic presence; name-agnostic by construction.
- `src/features/gear/screens/GearSetupScreen.tsx` — hosts `HR_BROADCAST_HINT` (recovery guidance for failed pairing) and `HR_DUAL_RECORDING_HINT` (Flow 1 vs Flow 2 info block). The Workout Recording Strategies section of this doc and those two copy constants are a single source of truth and must be updated together.
- `src/features/gear/hooks/useGearSetup.ts` — orchestrates scan → validate → connect → signal-confirm → persist; works identically for Garmin watches and chest straps.
