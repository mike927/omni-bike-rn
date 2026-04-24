# AGENTS.md — omni-bike-rn

Primary operating contract for any AI coding agent working on this project. Tool-agnostic by default; per-tool overlays (e.g. `CLAUDE.md`) cover tool-specific quirks only. If an overlay contradicts this file, this file wins.

## Project identity

Indoor cycling companion app. React Native / Expo, TypeScript, Drizzle + expo-sqlite, BLE FTMS (heart rate + trainer), Apple Health, Apple Watch companion via WatchConnectivity.

## Workflow

superpowers is the workflow core — don't invent parallel flows.

## Roadmap

Active work tracked in `ROADMAP.md`. Update states (`[ ] [~] [x] [-]`) as work progresses. Unresolved or exploratory items live in its **Future Considerations** section at the bottom.

## Dev loop

Canonical scripts (invoke via `npm run <name>`):

| Script | Purpose |
|---|---|
| `start` | Start Metro bundler on port 8081 |
| `ios` | Build and run on a connected iOS device (default) |
| `ios:sim` | Build and run on iOS Simulator |
| `android` | Build and run on Android |
| `lint` | Run ESLint (check only) |
| `lint:fix` | Run ESLint with autofix |
| `typecheck` | Run `tsc --noEmit` |
| `test` | Run Jest unit tests |
| `ci:gate` | Full pre-ship check (lint + typecheck + tests) |
| `db:generate` | Generate Drizzle migration from schema changes |
| `db:check` | Verify Drizzle migrations are clean |

## Git workflow

- **Never commit directly to `main`.** Before any commit, confirm the current branch is not `main`; if it is, create a feature branch first (e.g. `feat/…`, `fix/…`, `chore/…`, `docs/…`).
- Never bypass hooks with `--no-verify`. If the pre-commit hook fails, fix the root cause and create a new commit (do not `--amend`).
- Prefer small, focused commits. Never `git add -A` / `git add .` — stage files explicitly.

## Error recovery playbook

| Symptom | Auto-response |
|---|---|
| `EADDRINUSE :8081` | Kill PID on 8081, restart Metro |
| Bundler / cache errors | `expo start -c` |
| "No bundle URL present" | Verify Metro alive, reload app |
| Missing pod | `cd ios && pod install` |
| Native config drift | `npx expo prebuild --clean` |
| Dep resolution failures | Nuke `node_modules` + `package-lock.json`, reinstall |
| TS "Cannot find module" | Check if it's a missing Expo dep → `npx expo install` |
| Lint failures pre-commit | `lint:fix`, re-stage, retry commit (once) |
| Build fails repeatedly | Stop, summarize, escalate to the user |

## Escalation (stop and ask)

- Any failure that recurs after one auto-fix attempt
- Signing or provisioning errors on device builds
- Network or auth errors from external services (Strava, Apple Health)
- Anything that would require a commit, touch `.env`, or run a migration

## Platform notes

- **Bluetooth**: iOS Simulator does not support Bluetooth. Real BLE testing requires a physical device. Simulator can still exercise permission-request code paths.
- **Native modules**: `modules/apple-health-workout` and `modules/watch-connectivity` are local Expo modules. Changes to their native code require a rebuild.
- **Local overrides**: per-machine settings and evolving permission grants live in `.claude/settings.local.json` (gitignored). Create that file if it doesn't exist; commit durable changes into `.claude/settings.json` instead.
