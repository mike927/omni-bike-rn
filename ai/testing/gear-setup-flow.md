# Manual Testing: Gear Setup Flow

Branch: `feature/gear-setup-flow`

## Gear Setup — Bike

- [ ] Tap **Set Up Bike** on the Home screen
- [ ] Tap **Start Scan** — scan begins, nearby FTMS devices appear
- [ ] Select your Zipro Rave — status shows "Validating device…" then "Connecting…"
- [ ] Wait up to 8 seconds — "Waiting for live signal…" appears, then "Signal received ✓"
- [ ] **Use This Bike** button becomes enabled — tap it
- [ ] Returns to Home screen; "Zipro Rave" appears in the My Bike card

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

- [ ] Start gear setup, select a valid device, but keep the bike powered off
- [ ] After 8 seconds: "Device connected but no data received within 8 seconds" message appears
- [ ] **Try Another Device** resets correctly; device is disconnected

## Auto-Reconnect on Launch

- [ ] Save a bike and/or HR source, then force-quit and reopen the app
- [ ] Home screen shows "Connecting…" briefly, then "Connected" for each saved device
- [ ] Saved device names are visible without re-entering gear setup

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
