---
name: ble-hardware
description: Use this skill when implementing BLE adapters, connecting to the Zipro Rave, handling heart rate priorities, or managing background modes.
---
## BLE Connectivity & Adapters
* **Primary Source:** Zipro Rave bike trainer. Uses the Adapter Pattern (`BikeAdapter`).
* **Secondary Source:** BLE HR Monitors (Chest straps/armbands) using the standard HR Service `0x180D`.
* **Latency:** UI must update within ≤100ms of receiving a BLE notification.

## HR Source Priority
Strict priority for active HR data: 1. Apple Watch > 2. BLE HR Monitor > 3. Bike Pulse.
