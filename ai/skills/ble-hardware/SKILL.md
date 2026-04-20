---
name: ble-hardware
description: Use when working on BLE scanning, FTMS parsing, bike trainer behavior, or heart-rate device integrations in this repo.
---
# BLE Hardware

## Key Paths

- `src/features/devices/` — BLE feature logic and hooks
- `src/services/ble/` — BLE transport, adapters, and client
- `src/services/ble/parsers/` — Pure parsing functions
- `docs/vendor/zipro/rave/` — Trusted local ZIPRO Rave reference documents

## Reference Workflow

When ZIPRO Rave behavior, setup steps, or compatibility details matter, consult `docs/vendor/zipro/rave/` first.

## Core Protocol Notes

- FTMS service: `0x1826`
- Indoor Bike Data: `0x2AD2`
- Machine Status: `0x2ADA`
- Standard HR service: `0x180D`
- HR Measurement: `0x2A37`

## Known Repo Rules

- Keep BLE adapter files focused on behavior.
- Keep parsers pure.
- Reusable adapter types belong in sibling files or `src/types/`, not inside implementation files.
- The bike sends data and status notifications separately; the adapter merges them into one callback.
- Known Zipro Rave quirk: `FtmsMachineStatusOpCode` uses `0x04` for started/resumed instead of the standard `0x07`.

## See Also

- `ai/skills/architecture/SKILL.md` for the adapter pattern and layer rules that apply to all BLE code.
