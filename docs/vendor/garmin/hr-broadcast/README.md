# Garmin HR Broadcast (Watch as BLE HR Sensor)

Sources:
  - https://support.garmin.com/en-US/?faq=lCv1lPCEPI2VeOBq7Q7N17 (general cross-model support article)
  - https://www8.garmin.com/manuals/webhelp/venu/EN-US/GUID-8EC8B7FE-2AC2-46E9-94FC-06416FF1E2ED.html (Venu gen 1 owner's manual — Broadcasting Heart Rate)
  - https://www8.garmin.com/manuals-apac/webhelp/venu/EN-SG/GUID-4CC0ED9D-7C84-4B2E-994D-979121734430-8682.html (Venu gen 1 owner's manual — Wrist Heart Rate)
  - https://forums.garmin.com/sports-fitness/healthandwellness/f/venu/316374/venu-software-update---7-80 (Venu firmware 7.80 release thread, 2022-12-01)
Verified: 2026-04-15
Hardware tested against: Venu gen 1, firmware 7.80, Polish locale (**incompatible — see Compatibility section**)
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

### Product stance for Omni Bike

As of **2026-04-15**, the safest product stance for Omni Bike is:

- **Treat a Garmin watch as compatible only when it exposes a real BLE HR sensor role that Omni Bike can validate.** In practice that means the watch must enter a broadcast mode that results in a connectable BLE peripheral whose post-connect GATT table contains service `0x180D` and characteristic `0x2A37`.
- **Do not market compatibility based solely on model family, marketing pages, or the presence of a watch-side menu item named "Broadcast".** Those signals are not sufficient on their own; the watch must actually emit a BLE HR peripheral that iOS can discover.
- **When in doubt, trust runtime behaviour over model assumptions.** If the watch never appears during iPhone BLE discovery, or it connects but fails `validateHrDevice`, Omni Bike should treat it as incompatible regardless of branding or menu copy.

For user-facing compatibility copy, the correct summary is therefore:

> `A Garmin watch is compatible with Omni Bike only when it can broadcast a standard Bluetooth heart-rate signal that iPhone can discover and the app can validate as service 0x180D with characteristic 0x2A37.`

### Tested vs expected

Omni Bike's runtime HR path (`StandardHrAdapter`, `validateHrDevice`, `isLikelyHrCandidate`) is vendor-agnostic and routes solely on the standard BLE HR service `0x180D` / characteristic `0x2A37` plus a wearable vendor Company ID allowlist. That means **any** watch that actually advertises BLE HR in broadcast mode flows through the same code with zero per-model branching. The table below records what has been physically verified versus what is expected to work on the basis of Garmin's public documentation but has not been exercised on real hardware.

| Model / family | BLE HR broadcast status | Verification |
|---|---|---|
| **Venu gen 1, firmware 7.80** | **Incompatible (hardware).** The "Broadcast" and "Broadcast In Activity" items under Wrist Heart Rate are **ANT+ only** on this model — the watch does not emit a BLE HR advertisement in any mode (dedicated Broadcast screen, Broadcast In Activity with a running Indoor Cycling timer, or bonded via iOS Bluetooth settings). Confirmed via `[ScanDump]` diagnostic on 2026-04-15 across both menu items with Garmin Connect Mobile force-quit — Venu never appears in the scan callback. The Venu owner's manual is explicit: "Pair your Venu with a compatible ANT+ Garmin device". iPhones have no ANT+ radio, so Flow A (live BPM from watch → app) is not achievable on this specific model. | Real hardware, negative. |
| Venu 2 / Venu 2 Plus / Venu 3 | Expected to work: Garmin's general support article lists Venu 2+ under "Broadcast Heart Rate" (BLE). | Unverified on real hardware. |
| Fenix 6 and newer | Expected to work per Garmin support matrix. | Unverified on real hardware. |
| Forerunner 245 and newer | Expected to work per Garmin support matrix. | Unverified on real hardware. |
| Vivoactive 4 and newer | Expected to work per Garmin support matrix. | Unverified on real hardware. |
| Epix, Instinct 2, Tactix 7, Enduro 2, Marq Gen 2 | Expected to work per Garmin support matrix. | Unverified on real hardware. |

**If a user reports that a listed-as-expected model does not appear in the scan list**, capture `[ScanDump]` output (see diagnostic logging pathway in the next section) and compare to the "real advertisement shapes" table. The fix is almost always a small addition to `WEARABLE_VENDOR_COMPANY_IDS` in `scanFilters.ts` — not an architectural change.

## Detection contract with Omni Bike

This section answers the practical question: **what hardware / software elements must exist for Omni Bike to detect a Garmin watch as a valid HR sensor and then receive live BPM?**

All of the following must be true at the same time:

1. **The watch must expose a real BLE Heart Rate sensor role right now.**
   - Required over GATT after connection:
     - service `0x180D`
     - characteristic `0x2A37`
   - A watch merely having a manual page or menu item named "Broadcast Heart Rate" is **not** enough. Omni Bike's acceptance test is the post-connect GATT table, not marketing copy.
2. **The watch must be in the correct runtime mode.**
   - `Broadcast Heart Rate`, `HR Broadcast`, or the model-specific equivalent must be active.
   - On models that only sustain broadcast during an activity, a compatible activity (for example Indoor Cycling) must already be running.
   - If the model drops broadcast when the display sleeps or when the user exits the broadcast screen, the user must keep the watch in the state that actually emits the BLE peripheral.
3. **iPhone BLE discovery must be able to see the watch.**
   - Bluetooth must be enabled.
   - Omni Bike must have Bluetooth permission.
   - No other app may hold the watch's BLE link exclusively during pairing; in practice, Garmin Connect Mobile is the usual conflict and should be force-quit during troubleshooting.
4. **The watch must pass Omni Bike's scan + validation pipeline.**
   - Scan stage: the device must either advertise standard HR service `0x180D`, or present manufacturer data whose Company ID matches a known wearable vendor allowlist (Garmin `0x0087`, Polar `0x006B`, Suunto `0x01E7`, COROS `0x0553`, Amazfit `0x0157`, Wahoo `0x0067`).
   - Validation stage: after connection, `validateHrDevice(deviceId)` must find both `0x180D` and `0x2A37`.
   - Data stage: `StandardHrAdapter` must then receive notifications on `0x2A37`; only then is the sensor considered live.

If any one of the four conditions above is false, the user may still see Garmin-branded UI on the watch, but Omni Bike is correct to reject or fail the pairing attempt.

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

Omni Bike's recovery hint copy (`HR_BROADCAST_HINT` in `GearSetupScreen.tsx`) mentions both menu items so the user can pick whichever fits their situation. In practice, on Venu gen 1 specifically, the `Broadcast In Activity` toggle plus an Indoor Cycling activity on the watch is the more robust pairing path because it survives incidental display sleeps and Back-button navigation — but note that this whole workaround is academic for this particular model: Venu gen 1's broadcast feature is ANT+ only and never emits a BLE advertisement to pair against (see the definitive negative result in the Compatibility table above and the "On-device diagnosis notes" section below).

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
  | Garmin Venu gen 1 (companion/bond mode) | observed in some passes but variable | — | varies |
  | **Garmin Venu gen 1 (broadcast mode, any variant)** | **NEVER OBSERVED — watch does not emit a BLE advertisement in broadcast mode at all** | — | N/A — watch is invisible to `startDeviceScan` |

  The "broadcast mode" row was left TODO in an earlier revision of this doc in the hope that a future diagnostic pass would capture real data. That pass happened on 2026-04-15 and the result is definitive: **Venu gen 1 firmware 7.80 does not emit a BLE HR advertisement in any broadcast variant.** Both Ścieżka 1 (dedicated Broadcast screen) and Ścieżka 2 (Transmituj gdy aktywny toggle ON + Indoor Cycling activity running) produced `[ScanDump]` logs containing zero lines matching `Venu`, `Garmin`, or `companyId=0x0087` — across ~60 seconds of continuous scan with Garmin Connect Mobile force-quit and iOS Bluetooth toggled off/on between attempts. The surrounding noise floor (Sonos, Samsung TV, MacBook, Apple Watch, AirPods Pro, HwZ) was captured normally, which rules out a scan pipeline or permission problem. The conclusion is consistent with the Venu owner's manual language: the watch's Broadcast Heart Rate feature is ANT+ only on Venu gen 1, and iPhones have no ANT+ radio. Do not repopulate this row with optimistic "not yet captured" wording — the data exists, and it is a negative.

- **Do not trust "empty advertisement means wearable" heuristics.** The earlier revision of `isLikelyHrCandidate` accepted any device that advertised with `serviceUUIDs === null || []`. Real-hardware data proved Apple-family and Samsung devices behave exactly the same way, so the heuristic was a false-positive magnet. The filter now requires positive HR proof (standard HR service in ad, or known wearable vendor Company ID in manufacturer data). See `scanFilters.ts` doc comment for the full rationale.
- **Diagnostic logging pathway (how to re-enable).** `src/features/devices/hooks/useBleScanner.ts` previously contained a `__DEV__`-gated `[ScanDump]` `console.warn` that dumped every named device's full advertisement (`serviceUUIDs`, `manufacturerData`, decoded Company ID, `rssi`) along with a `REJECTED by clientFilter` marker when the filter dropped a candidate. That diagnostic was removed after the 2026-04-15 pass completed its job (producing the advertisement shapes table above and the definitive Venu gen 1 negative). A comment in `useBleScanner.ts` at the same location points future contributors back here. **If a future Venu / Polar / COROS user reports "my watch is not visible"**, re-add the diagnostic temporarily: log `device.name`, `device.id`, `device.rssi`, `device.serviceUUIDs`, `device.manufacturerData`, and the decoded 16-bit Company ID (first two bytes of `manufacturerData`, little-endian) for every scan callback, plus a `REJECTED by clientFilter` marker when `clientFilter(device)` returns false. Keep it gated on `__DEV__`. The fix, if the filter is at fault, will almost always be a small addition to `WEARABLE_VENDOR_COMPANY_IDS` in `scanFilters.ts` — not an architectural change.

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

## HR source transparency (UX invariant)

Omni Bike deliberately treats all HR sources — chest straps and broadcast-capable watches alike — as **interchangeable sensor peers** at the gear-setup layer. The user chooses "Add Bluetooth HR", the scan surfaces any device that advertises a standard HR signal (or is a known wearable vendor), the generic validator checks `0x180D` / `0x2A37` via GATT, and persistence stores a single `SavedDevice` with no `source category` field. There is no "chest strap vs watch" split in the picker, no pre-training tip that changes based on source type, and no copy that asks the user to think about which kind of device they are pairing.

An earlier revision of this feature shipped a pre-training "Garmin Connect Tip" info block on the HR gear-setup screen that expanded into a Flow 1 vs Flow 2 dual-recording explainer. It was removed before the feature closed because it violated the transparency invariant: it forced the gear-setup UI to know whether the sensor was a watch, and pushed Garmin-ecosystem concerns into a surface whose only job is to confirm a live BLE signal. Dual-recording guidance — if it is ever surfaced in-app again — belongs to a post-session / upload-destinations surface (closer to the Strava provider settings), not to the point of pairing an HR sensor.

The only remaining watch-aware copy on `GearSetupScreen.tsx` is the **recovery hint** (`HR_BROADCAST_HINT`), which appears **only** when HR validation has already failed with `missing_hr_service`, `missing_hr_characteristic`, or `no_live_signal`. At that point the user's pairing attempt has demonstrably broken and a diagnostic ("is your watch in broadcast mode?") is warranted. The hint is a recovery aid, not proactive UI — it does not split the default experience.

## Code cross-references

- `src/services/ble/StandardHrAdapter.ts` — vendor-agnostic adapter that connects to any device exposing `0x180D` / `0x2A37`. Handles Garmin watches in HR Broadcast mode with zero vendor-specific code.
- `src/services/ble/bleDeviceValidator.ts` — `validateHrDevice(deviceId)` checks the service/characteristic presence; name-agnostic by construction.
- `src/services/ble/scanFilters.ts` — `isLikelyHrCandidate` is the client-side heuristic filter that compensates for iOS `CBCentralManager.scanForPeripherals(withServices:)` dropping watches that don't advertise `0x180D`. The wearable vendor Company ID allowlist lives here. Extend it here if a future user reports a model missing from the scan list.
- `src/features/gear/screens/GearSetupScreen.tsx` — hosts `HR_BROADCAST_HINT` (recovery guidance for failed pairing). This is the **only** remaining SSOT pair with this doc — if the hint copy changes, update both together.
- `src/features/gear/hooks/useGearSetup.ts` — orchestrates scan → validate → connect → signal-confirm → persist; works identically for Garmin watches and chest straps.
