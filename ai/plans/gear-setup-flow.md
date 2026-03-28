# Plan: Gear Setup Flow

Branch: `feature/gear-setup-flow`

## Scope

Covers these Phase 2 tasks as one cohesive feature:

- Functional gear setup flow (select single main bike and HR source)
- Support standard Bluetooth HR sensors (chest straps, broadcast-capable watches)
- Validate selected bike and HR devices against the required sensor mode
- Explain unsupported or incompatible devices clearly; prevent saving incompatible gear
- Require live metric / HR signal before saving preferred gear
- Remember selected main bike and preferred Bluetooth HR source
- Auto-reconnect saved devices on app launch / Home screen
- Inline reconnect failure states (Retry, Choose Another, Forget)
- Minimal My Gear management in Settings
- Extensible gear model (bike-first, treadmill-ready)
- Just-in-time Bluetooth permission UX

## Product Decisions (Approved)

| Question | Decision |
|---|---|
| Signal confirmation | Unlock "Use This Device" on first live data packet |
| HR required? | Optional — bike is required, HR can be skipped and added later |
| No-signal timeout | Block saving after 8 s with a "No data received" message + Retry |
| "Choose Another Device" | Push directly into gear setup scoped to the failing device type |

---

## Data Model

Persisted as a single JSON blob under AsyncStorage key `omni:savedGear`.

```ts
// src/types/gear.ts
interface SavedDevice {
  id: string;    // BLE device UUID
  name: string;  // display name, stored at save time
  type: GearType;
}

type GearType = 'bike' | 'hr';

interface SavedGear {
  savedBike: SavedDevice | null;
  savedHrSource: SavedDevice | null;
}

interface GearValidationResult {
  valid: boolean;
  reason?: 'missing_ftms_service' | 'missing_indoor_bike_characteristic'
         | 'missing_hr_service' | 'missing_hr_characteristic' | 'no_live_signal';
}

type ReconnectState = 'idle' | 'connecting' | 'connected' | 'failed';
```

---

## New Files

### `src/types/gear.ts`
All shared gear types. No implementation.

### `src/services/gear/gearStorage.ts`
AsyncStorage wrapper. Pure async functions, no state:
- `loadSavedGear(): Promise<SavedGear>`
- `saveBikeDevice(device: SavedDevice): Promise<void>`
- `saveHrDevice(device: SavedDevice): Promise<void>`
- `forgetBikeDevice(): Promise<void>`
- `forgetHrDevice(): Promise<void>`

### `src/services/ble/bleDeviceValidator.ts`
Connects to a device, discovers services/characteristics, disconnects. Returns `GearValidationResult`.
- `validateBikeDevice(deviceId): Promise<GearValidationResult>` — requires FTMS `0x1826` + Indoor Bike Data `0x2AD2`
- `validateHrDevice(deviceId): Promise<GearValidationResult>` — requires HR Service `0x180D` + HR Measurement `0x2A37`

Disconnects after validation in all cases (success and failure).

### `src/store/savedGearStore.ts`
Zustand store. Owns saved device prefs and reconnect states.

```ts
interface SavedGearStore {
  savedBike: SavedDevice | null;
  savedHrSource: SavedDevice | null;
  hydrated: boolean;
  bikeReconnectState: ReconnectState;
  hrReconnectState: ReconnectState;

  hydrate: () => Promise<void>;
  setSavedBike: (device: SavedDevice | null) => void;
  setSavedHrSource: (device: SavedDevice | null) => void;
  setBikeReconnectState: (state: ReconnectState) => void;
  setHrReconnectState: (state: ReconnectState) => void;
}
```

`hydrate()` called once from `app/_layout.tsx` on mount.

### `src/features/gear/hooks/useSavedGear.ts`
Reads `savedGearStore`, exposes forget actions (calls storage + updates store).

### `src/features/gear/hooks/useAutoReconnect.ts`
Mounted by HomeScreen. If a saved device exists and its adapter is null, fires auto-reconnect. Exposes `bikeReconnectState`, `hrReconnectState`, `retryBike`, `retryHr`.

### `src/features/gear/hooks/useGearSetup.ts`
Orchestrates the setup flow. Accepts `target: 'bike' | 'hr'`. Composes `useBleScanner`, `useBlePermission`, `bleDeviceValidator`, `useDeviceConnection`, `gearStorage`.

Flow when user taps a device:
1. Stop scan
2. Validate device (`bleDeviceValidator`)
3. If invalid → set `validationError`, show explanation, do not connect
4. If valid → connect adapter (`useDeviceConnection.connectBike/connectHr`)
5. Wait for first live metric → set `signalConfirmed = true`, unlock save
6. Timeout at 8 s → set `validationError: 'no_live_signal'`, show retry
7. On `save()` → persist to storage, update store, pop screen

Scans are filtered by service UUID: `['00001826-0000-1000-8000-00805f9b34fb']` for bike, `['0000180d-0000-1000-8000-00805f9b34fb']` for HR.

### `src/features/gear/screens/GearSetupScreen.tsx`
Full-screen stack push. Shows:
- Scan controls (Start / Stop)
- Device list with per-device validation state
- Incompatibility explanation inline below failing device row
- "Signal received ✓" indicator once live data flows
- "Use This Bike" / "Use This HR Source" button (disabled until `signalConfirmed`)

### `app/gear-setup.tsx`
Thin route file. Reads `target` from `useLocalSearchParams()`, renders `GearSetupScreen`.

---

## Modified Files

### `app/_layout.tsx`
- Add `<Stack.Screen name="gear-setup" options={{ title: 'Select Device' }} />`
- Call `savedGearStore.hydrate()` on mount (guarded by `hydrated` flag)

### `src/features/home/screens/HomeScreen.tsx`
Remove:
- `inferDeviceType()` function
- `handleScanPress`, `handleConnect` functions
- "Scan Nearby Devices" SectionCard
- `useBleScanner`, `useBlePermission` imports

Update:
- "My Bike" card → saved device name + reconnect state + actions (Set Up / Retry / Choose Another / Forget)
- "Heart Rate" card → same pattern

Add hooks: `useSavedGear`, `useAutoReconnect`

### `src/features/settings/screens/SettingsScreen.tsx`
Replace placeholder cards with real "My Gear" section:
- Bike row: name, Replace (→ `gear-setup?target=bike`), Forget
- HR row: name, Replace, Forget — or "Add HR Source" if empty
- Keep "Disconnect Active Gear" button

---

## Incompatibility Messages

| Reason | Message |
|---|---|
| `missing_ftms_service` | "This device does not support the Fitness Machine Service (FTMS). Only FTMS-compatible bike trainers can be used." |
| `missing_indoor_bike_characteristic` | "This device uses FTMS but does not broadcast indoor bike data. It may be a different type of fitness machine." |
| `missing_hr_service` | "This device does not broadcast a standard heart-rate signal. Only HR monitors and compatible watches in broadcast mode are supported." |
| `missing_hr_characteristic` | "This device has the HR service but is missing the HR Measurement characteristic." |
| `no_live_signal` | "Device connected but no data received within 8 seconds. Make sure the bike is powered on, then try again." |

---

## Auto-Reconnect Strategy

`useAutoReconnect` fires on HomeScreen mount via `useEffect`:
- If `hydrated` and `savedBike` exists and `bikeAdapter` is null and `bikeReconnectState === 'idle'` → attempt reconnect
- Same for HR
- Guard with a ref to prevent concurrent attempts
- `retryBike()` / `retryHr()` reset state to `'idle'` to re-trigger the effect

Reconnect state transitions: `idle → connecting → connected | failed → (retry) → connecting`

---

## Test Coverage

| File | What is tested |
|---|---|
| `src/services/gear/__tests__/gearStorage.test.ts` | load defaults, save, forget bike, forget HR, round-trip |
| `src/services/ble/__tests__/bleDeviceValidator.test.ts` | valid bike, missing FTMS, missing char, valid HR, missing HR service, disconnects after validation |
| `src/store/__tests__/savedGearStore.test.ts` | hydrate, setSavedBike, reconnect state transitions |
| `src/features/gear/hooks/__tests__/useSavedGear.test.ts` | forget bike, forget HR, reflects hydrated state |
| `src/features/gear/hooks/__tests__/useAutoReconnect.test.ts` | auto-reconnect on mount, failed state, retry, no double-attempt |
| `src/features/gear/hooks/__tests__/useGearSetup.test.ts` | valid device flow, invalid device sets error, signal timeout, save persists |

---

## Implementation Order

1. Install `@react-native-async-storage/async-storage`
2. `src/types/gear.ts`
3. `src/services/gear/gearStorage.ts` + tests
4. `src/store/savedGearStore.ts` + tests
5. `src/services/ble/bleDeviceValidator.ts` + tests
6. `src/features/gear/hooks/useSavedGear.ts` + tests
7. `app/_layout.tsx` — add route + hydrate call
8. `src/features/gear/hooks/useGearSetup.ts` + tests
9. `src/features/gear/screens/GearSetupScreen.tsx`
10. `app/gear-setup.tsx`
11. `src/features/gear/hooks/useAutoReconnect.ts` + tests
12. `HomeScreen.tsx` refactor
13. `SettingsScreen.tsx` refactor
14. `npm run ci:gate`

---

## Status

- [x] Approved by user

---

## Addendum: iOS Warning Cleanup

### Goal

Reduce Xcode warning noise that is fixable in this repository without patching generated `ios/Pods` files by hand.

### Findings

1. `ios/` is generated by Expo prebuild and is ignored in git, so direct native edits are not durable.
2. The deployment-target mismatch warnings can be addressed by mutating the generated Podfile during prebuild.
3. The large remaining warning set shown in Xcode is dominated by upstream Expo / React Native header warnings such as:
   - missing nullability specifiers
   - non-portable include path / Yoga header case warnings
4. The deployment-target cleanup and warning-suppression logic should therefore live in a local Expo config plugin committed to the repo.

### Proposed Changes

1. Add a local config plugin at `plugins/with-ios-warning-fixes.js`.
2. Register that plugin in `app.json`.
3. Use the plugin to:
   - set the generated iOS deployment target baseline to `18.0`
   - normalize generated pod resource bundle targets to the same deployment target in `post_install`
4. Re-run Expo prebuild and inspect the resulting warning set.
5. If nullability/include-path warnings are still overwhelmingly noisy after the deployment-target fix, extend the same plugin with targeted Podfile-level warning suppression for upstream pods only.

### Validation

1. `npx expo prebuild --clean --platform ios`
2. `cd ios && pod install --repo-update`
3. Open `ios/omnibikern.xcworkspace` in Xcode
4. Clean and build
5. Compare the warning categories before and after
