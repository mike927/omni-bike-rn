# AGENTS.md — omni-bike-rn

Primary operating contract for any AI coding agent working on this project. Tool-agnostic by default; per-tool overlays (e.g. `CLAUDE.md`) cover tool-specific quirks only. If an overlay contradicts this file, this file wins.

## Project identity

Indoor cycling companion app. React Native / Expo, TypeScript, Drizzle + expo-sqlite, BLE FTMS (heart rate + trainer), Apple Health, Apple Watch companion via WatchConnectivity.

## Workflow

superpowers is the workflow core — don't invent parallel flows.

## Roadmap

Active work tracked in `ROADMAP.md`. Update states (`[ ] [~] [x] [-]`) as work progresses. Unresolved or exploratory items live in its **Future Considerations** section at the bottom.

## Dev loop

Run scripts via `npm run <name>` — see `package.json` for the full list. The ones worth knowing by name: `ci:gate` (lint + typecheck + tests, the pre-ship gate) and `db:generate` / `db:check` (Drizzle migrations).

## Builds

Default to `npm run ios` (device build) when an iPhone is detected via `xcrun devicectl list devices`. Otherwise fall back to `npm run ios:sim`.

## Git workflow

- **Never commit directly to `main`.** Before any commit, confirm the current branch is not `main`; if it is, create a feature branch first (e.g. `feat/…`, `fix/…`, `chore/…`, `docs/…`).
- Never bypass hooks with `--no-verify`. If the pre-commit hook fails, fix the root cause and create a new commit (do not `--amend`).

## Domain model

- **HR source priority:** Watch → BLE HR monitor → bike pulse.
- **Calorie source priority:** Watch-computed → HR + profile (Keytel) → power-based → bike-reported.
- **Provider adapter contract:** external upload providers (Strava today, Garmin next) share one interface for save-and-upload. New providers slot into that contract — don't build parallel paths.
- **Gear model:** one main bike + optional HR source. Extensible to other FTMS equipment types later, but bike-first today.

## Runtime

- Requires a **custom dev client** — not Expo Go. BLE, HealthKit, and the watch-connectivity native module need native code.
- **Bluetooth:** iOS Simulator cannot do BLE. Real BLE testing requires a physical device. Simulator still exercises permission-request code paths.
- **Native modules:** `modules/apple-health-workout` and `modules/watch-connectivity` are local Expo modules. Native-code changes require a rebuild.
- **Never run `expo prebuild --clean`.** The watchOS companion app target lives inside `ios/`; a clean prebuild wipes it.
- **Secrets:** Strava client ID and secret live in `.env` (gitignored). Never read or print them.

## Harness non-goals

Explicitly rejected to keep the harness minimal:

- **Pre-push `ci:gate` hook** — pre-commit already covers lint + typecheck.
- **PR template / CI drift check** — wait until the team grows beyond solo.
- **Filled `CODEX.md` / `GEMINI.md`** — placeholders only; populate when those tools are actually used.

Custom project skills and slash commands are welcome if a real gap appears that no marketplace plugin fills — the harness supports them.
