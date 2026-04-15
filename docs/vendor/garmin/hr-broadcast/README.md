# Garmin HR Broadcast (Watch as BLE HR Sensor)

Source: https://support.garmin.com/en-US/?faq=lCv1lPCEPI2VeOBq7Q7N17
Verified: 2026-04-15
Local copy: none — live web article, not a PDF manual. Re-verify against the source URL before trusting instructions.

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

Exact button path on Fenix / Forerunner / Venu / Vivoactive families (the menu labels are identical):

1. Hold **UP** to open the main menu.
2. Go to **Settings → Sensors & Accessories → Wrist Heart Rate**.
3. Select **Broadcast HR** (some models label it **Broadcast During Activity**).
4. Confirm the broadcast icon appears on the watch face before returning to the Omni Bike app.

This text is mirrored in `GearSetupScreen.tsx` via the `HR_BROADCAST_HINT` module constant. If the button path ever changes, update **both** this doc and that constant in the same commit. They are a single source of truth.

## Known limitations

- **Advertisement packet does NOT include `0x180D`.** This is the single biggest gotcha for iOS integration. Garmin watches in HR Broadcast mode (verified on Venu gen 1 with firmware 6.x) expose the standard BLE HR service `0x180D` / characteristic `0x2A37` through GATT *after* connection, but they do **not** include `0x180D` in the advertisement packet. iOS `CBCentralManager.scanForPeripherals(withServices:)` filters strictly by advertised service UUIDs, which means passing `[0x180D]` as a scan filter silently drops every Garmin watch in broadcast mode from scan results even though they are valid BLE HR sensors. Chest straps (e.g. Garmin HRM-Dual) do advertise `0x180D` and are unaffected.

  Omni Bike handles this with a two-layer approach:
  1. **OS scan** is issued with **no service UUID filter** when the gear-setup target is HR (`useGearSetup.ts` → `HR_SCAN_SERVICE_FILTER = null`). The broad scan surfaces the watch.
  2. **Client-side heuristic filter** (`src/services/ble/scanFilters.ts` → `isLikelyHrCandidate`) then removes laptops, TVs, headphones, and phones from the nearby-devices list. A device is shown if it advertises `0x180D`, or its manufacturer data starts with a known wearable vendor Company ID (Garmin `0x0087`, Polar `0x006B`, Suunto `0x01E7`, COROS `0x0553`, Amazfit `0x0157`, Wahoo `0x0067`), or its advertisement contains no service UUIDs at all (empirical Venu behaviour).
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
