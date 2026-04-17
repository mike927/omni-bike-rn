# Project Docs

Repository-owned reference documents that agents and humans can consult when implementation details need a trusted source.

## Vendor References

- [ZIPRO Rave manual](./vendor/zipro/rave/README.md)
- [Garmin HR Broadcast](./vendor/garmin/hr-broadcast/README.md)

## Platform Findings

- [Apple Watch wake-on-start from iPhone](./apple-watch/wake-on-start.md) — investigation notes for programmatically foregrounding the Watch app when a ride starts on iPhone

## Usage

- Keep vendor manuals and compliance documents under `docs/vendor/<brand>/<model>/`.
- Add a local `README.md` next to each downloaded document with the official source URL, verification date, and checksum.
- Prefer local copies in `docs/` when an agent needs to confirm hardware behavior or product-specific details.
- Cross-model features (a behavior that spans multiple models of the same brand) may occupy the model slot with a feature slug (e.g. `vendor/garmin/hr-broadcast/`) instead of a model name, when the upstream documentation is a live web article rather than a downloadable manual — in that case the local `README.md` metadata block states `Local copy: none` and must cite the exact source URL and verification date.
