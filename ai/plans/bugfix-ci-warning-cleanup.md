# PR Warning Cleanup Follow-up

## Summary

These annotations are worth fixing, but they are follow-up hygiene work rather than a merge blocker for PR `#19` because that PR was already merged on March 29, 2026 and the check still passed. The actionable items are:

- GitHub Actions runtime deprecation: update the workflow before GitHub switches JavaScript actions to Node 24 by default on June 2, 2026 and removes Node 20 on September 16, 2026.
- Lint warnings in the FTMS parser and related tests: clean them up so BLE parsing stays warning-free and safer around truncated payloads.
- `useBikeConnection.ts`: remove it as dead code instead of just replacing its `console.log` calls, since it appears unused in the repo.

## Key Changes

- Update `.github/workflows/pr-check.yml` from `actions/checkout@v4` and `actions/setup-node@v4` to their Node-24-compatible major versions, keeping the existing job structure and `node-version: 22`.
- Refactor `src/services/ble/parsers/ftmsParser.ts` to eliminate non-null assertions by using explicit length-checked byte reads.
  Keep parser behavior identical for valid FTMS payloads.
  Make incomplete payload handling explicit and safe instead of relying on `!`.
- Extend parser test coverage to include truncated payload cases for each optional FTMS field path that now uses guarded reads.
- Clean the adapter test helper logic that builds base64 strings so it no longer uses non-null assertions while preserving the same decoded payload expectations.
- Remove `src/features/devices/hooks/useBikeConnection.ts` as unused code.
  Update any nearby JSDoc or architecture notes that still mention it as a public hook so repo guidance matches the actual feature API.

## Public APIs / Interfaces

- Internal feature API change: remove the unused `useBikeConnection` hook from the devices hook surface.
- No intended change to runtime BLE parsing outputs, FTMS status mapping, workflow behavior, or app UX.

## Test Plan

- Run parser unit tests and confirm existing speed, cadence, distance, resistance, power, and heart-rate expectations still pass.
- Add regression tests for short or truncated FTMS payloads to verify the parser returns partial data or `undefined` safely without assertions.
- Re-run the adapter test that decodes base64 metric/status payloads after the helper cleanup.
- Run `npm run lint`, `npm run typecheck`, and `npm test -- --ci --runInBand`.
- On the follow-up PR, confirm GitHub Actions no longer reports the Node 20 deprecation warning and no longer annotates these affected files.

## Assumptions

- Implementation will start on a new branch, recommended name: `bugfix/ci-warning-cleanup`.
- Because this turn stayed in planning mode on `main`, the required detailed repo plan file should be created at `ai/plans/bugfix-ci-warning-cleanup.md` immediately before implementation.
- Use `actions/checkout@v5` and `actions/setup-node@v5` as the minimal workflow bump to resolve the deprecation without taking on the broader v6 behavior changes.
