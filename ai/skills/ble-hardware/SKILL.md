---
name: ble-hardware
description: Use this skill for BLE scanning, FTMS parsing, bike trainer behavior, and heart-rate device work in this repo.
---
# BLE Hardware

Use this skill when the task is about BLE scanning, FTMS parsing, bike devices, or heart-rate monitors.

## Key Paths

- `src/features/devices/` — BLE feature logic and hooks
- `src/services/ble/` — BLE transport, adapters, and client
- `src/services/ble/parsers/` — Pure parsing functions
- `docs/vendor/zipro/rave/` — Trusted local ZIPRO Rave reference documents

## Trusted Reference Workflow

When ZIPRO Rave device behavior, setup steps, console behavior, or compatibility details matter, consult the local vendor docs in `docs/vendor/zipro/rave/` first. Treat those files as the preferred product-specific source before using memory or non-vendor pages.

Keep BLE adapter files focused on behavior.

Adapter-specific type placement follows `AGENTS.md` § `Coding Conventions` — reusable interfaces and type aliases live in sibling files or `src/types/`, not inside adapter implementation files.

## FTMS (Fitness Machine Service)

The primary bike protocol. Key UUIDs:

| Item | UUID |
|---|---|
| FTMS Service | `0x1826` |
| Indoor Bike Data | `0x2AD2` |
| Machine Status | `0x2ADA` |
| HR Service (standard) | `0x180D` |
| HR Measurement | `0x2A37` |

### Indoor Bike Data Flags (16-bit)

The parser reads a 16-bit flags field and walks the byte array dynamically:

| Bit | Field | Size | Notes |
|---|---|---|---|
| 0 (inverted) | Instantaneous Speed | UINT16 | Present when bit is **0**; resolution 0.01 km/h |
| 1 | Average Speed | UINT16 | Skipped if present |
| 2 | Instantaneous Cadence | UINT16 | Resolution 0.5 RPM |
| 3 | Average Cadence | UINT16 | Skipped if present |
| 4 | Total Distance | UINT24 | Meters |
| 5 | Resistance Level | SINT16 | Signed |
| 6 | Instantaneous Power | SINT16 | Watts, signed |
| 9 | Heart Rate | UINT8 | BPM |

### Machine Status OpCodes

Defined in `FtmsMachineStatusOpCode` enum. Known Zipro Rave quirk: the bike uses `0x04` for "started/resumed" instead of the standard `0x07`.

## Known Quirks (Zipro Rave)

- Uses `atob`/`charCodeAt` for base64 → byte conversion (no `Buffer` available in this path).
- `StandardHrAdapter` uses `Buffer.from()` instead (polyfilled via `buffer` package).
- The bike sends BLE notifications on two characteristics simultaneously (data + status). The adapter merges them into a single `BikeMetrics` callback.

## See Also

- `ai/skills/architecture/SKILL.md` for the adapter pattern and layer rules that apply to all BLE code.
