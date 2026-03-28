# Manual Testing: Gear Setup Flow

Branch: `feature/gear-setup-flow`

## Prerequisites

- No rebuild and no Metro/server restart are required for this JS-only review pass
- If the app is already open, reload it once so the latest bundle is active
- Have your Zipro Rave bike and optional HR monitor nearby and powered on
- For disconnect/failure tests, be ready to power off the bike

---

## Gear Setup — Bike

- [ ] Tap **Set Up Bike** on the Home screen
- [ ] Tap **Start Scan** — scan begins, nearby FTMS devices appear
- [ ] Select your Zipro Rave — status shows "Validating device…" then "Connecting…"
- [ ] Start pedaling — "Waiting for live signal…" appears, then "Signal received ✓"
- [ ] **Use This Bike** button becomes enabled — tap it
- [ ] Returns to Home screen; "Zipro Rave" appears in the My Bike card
- [ ] Live metrics (speed, power) update on the Home screen

> **Bug 1 regression check:** The validator no longer disconnects after successful validation, so the adapter reuses the existing BLE connection. Pedaling should produce a signal — if you see "no data received within 8 seconds" despite pedaling, the fix has regressed.

## Gear Setup — HR Source (optional)

- [ ] Tap **Add HR Source** on the Home screen
- [ ] Tap **Start Scan** — HR devices appear (chest strap, broadcast watch)
- [ ] Select your HR monitor — validates, connects, awaits signal
- [ ] Signal confirmed — tap **Use This HR Source**
- [ ] Returns to Home; HR source name appears in the Heart Rate card

## Incompatible Device Handling

- [ ] In bike setup, select a non-FTMS device — incompatibility message appears below the device row, device is not connected
- [ ] In HR setup, select a non-HR device — incompatibility message appears, device is not connected
- [ ] **Try Another Device** resets the flow back to the scan list

## No-Signal Timeout

- [ ] Start gear setup, select a valid device, but do NOT pedal
- [ ] After 8 seconds: "Device connected but no data received within 8 seconds" message appears
- [ ] **Try Another Device** resets correctly; device is disconnected

## Full Workout Cycle

- [ ] Set up bike → start training → pedal → pause → resume → finish workout
- [ ] On the Training screen, tap **View Summary**
- [ ] On the Summary screen, verify totals are shown and tap **Done**
- [ ] App returns to Home; My Bike no longer shows an active connection
- [ ] My Bike status settles to **Not connected** / `disconnected` rather than surfacing a reconnect failure
- [ ] Tap **Retry** on the My Bike card
- [ ] Bike reconnects successfully and live metrics resume on Home

> **Bug 2 regression check:** The `Done` path now disconnects through the shared device-connection teardown before the next reconnect attempt. After finishing a workout, tapping **Retry** should not produce `Operation was cancelled`, and the bike should recover from `disconnected` back to `connected`.

## Post-Workout Reconnect Regression

- [ ] Connect the bike and confirm Home shows **Connected**
- [ ] Start a short workout and pedal long enough to receive live metrics
- [ ] Finish the workout and tap **Done** on the Summary screen
- [ ] Back on Home, wait a moment for the bike state to settle
- [ ] Confirm the physical bike has left the prior app-controlled state and is ready for a fresh BLE session
- [ ] Confirm the My Bike card does not show **Connection failed**
- [ ] Tap **Retry**
- [ ] Confirm the My Bike card does not get stuck on **Connecting…** with no recovery
- [ ] Confirm reconnect begins cleanly, without a redbox or error log for `Operation was cancelled` or `Reconnect timeout`
- [ ] If the first native reconnect is cancelled, confirm the card stays on **Connecting…** long enough for an internal retry instead of flashing straight back to **Not connected**
- [ ] Confirm the final state is **Connected**

> **Bug 4 regression check:** After `Done`, retry now forces a fresh native BLE connection instead of reusing a stale half-disconnected session. The bike should reconnect cleanly rather than hanging on **Connecting…**.

## Auto-Reconnect on Launch — Happy Path

- [ ] Save a bike and/or HR source, then force-quit and reopen the app
- [ ] Home screen shows "Connecting…" briefly, then "Connected" for each saved device
- [ ] Saved device names are visible without re-entering gear setup

## Auto-Reconnect on Launch — Device Unavailable

- [ ] Save a bike, power off the bike, force-quit and reopen the app
- [ ] Home screen shows "Connecting…" with a **Forget** button visible
- [ ] After ≤10 seconds, state changes to "Connection failed"
- [ ] **Retry**, **Choose Another**, and **Forget** buttons appear
- [ ] Tap **Forget** — bike is removed, "Set Up Bike" button reappears

> **Bug 3 regression check:** Previously the app would hang on "Connecting…" forever with no escape. Now a 10-second timeout triggers failure, and the Forget button is available even during the connecting phase.

## Auto-Reconnect on Launch — Forget During Connecting

- [ ] Save a bike, power off the bike, reopen the app
- [ ] While "Connecting…" is shown, tap **Forget**
- [ ] Bike is removed immediately; no crash or error

## Reconnect Failure Actions

- [ ] With a saved bike, power off the bike before opening the app
- [ ] Home screen shows "Connection failed" and reveals **Retry**, **Choose Another**, **Forget**
- [ ] **Retry** attempts reconnect again (back to "Connecting…")
- [ ] **Choose Another** opens gear setup scoped to bike
- [ ] **Forget** removes the saved bike; "Set Up Bike" button reappears

## Disconnect Detection

- [ ] Connect bike, go to Settings → tap **Disconnect Active Gear**
- [ ] Returns to Home; My Bike card shows reconnect actions (Retry / Choose Another / Forget)
- [ ] Bike reconnect state is `disconnected`, not `failed`

## Settings — My Gear

- [ ] Settings screen shows saved bike and HR source names under **My Gear**
- [ ] **Replace** (bike) → navigates to gear setup for bike
- [ ] **Replace** (HR) → navigates to gear setup for HR
- [ ] **Forget** (bike) → bike row resets to "Not set", Set Up button appears
- [ ] **Forget** (HR) → HR row resets to "Not set", Add HR Source button appears
- [ ] **Disconnect Active Gear** disabled when nothing is connected; enabled when connected
