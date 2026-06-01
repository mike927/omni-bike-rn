# AGENTS.md — omni-bike-rn

Primary operating contract for any AI coding agent working on this project. Tool-agnostic by default; per-tool overlays (e.g. `CLAUDE.md`) cover tool-specific quirks only. If an overlay contradicts this file, this file wins.

## Project identity

Indoor cycling companion app. React Native / Expo, TypeScript, Drizzle + expo-sqlite, BLE FTMS (heart rate + trainer), Apple Health, Apple Watch companion via WatchConnectivity.

## Workflow

superpowers is the workflow core — don't invent parallel flows.

## Skill management

- External skills are declared in `skills-lock.json`.
- Custom repo-owned skills live in `ai/skills/**`.
- Agent discovery directories (`.agents/skills/**`, `.claude/skills/**`, `.codex/skills/**`, `.cursor/skills/**`, `.gemini/skills/**`, `.windsurf/skills/**`) are generated; don't edit or commit skill files there.
- Run `npm run skills:install` after changing `skills-lock.json` or adding/removing a custom skill.
- Editing an existing `ai/skills/**` file does not require reinstall; restart or reload the agent session if it does not pick up the change.

## Engineering principles

- **Canonical over clever.** Implement the recommended, documented approach — no workarounds, monkey-patches, or one-off shims.
- **Rebuild over patch.** When a structure is wrong (e.g. status management), redesign it cleanly — even from scratch — rather than layering fixes on the broken shape.
- **Simplest thing that holds.** No speculative abstraction or premature generality; solve the case in front of you.
- **Feasible on real transport.** Confirm a design works over the actual watch ↔ app ↔ bike connectivity before building it.
- **Idempotent teardown.** Release a resource by whether it exists, not by the current value of a mutable input that may have drifted since acquisition.

## Roadmap

Active work tracked in `ROADMAP.md`. Update states (`[ ] [~] [x] [-]`) as work progresses. Unresolved or exploratory items live in its **Future Considerations** section at the bottom.

## Dev loop

Run scripts via `npm run <name>` — see `package.json` for the full list. The ones worth knowing by name: `ci:gate` (lint + typecheck + tests, the pre-ship gate) and `db:generate` / `db:check` (Drizzle migrations).

**Tests (dev loop):** run `npm run test:changed` (`jest --changedSince=main` — branch-affected tests only); the full `npm test` is CI's job (`ci:gate`). A green run means "changed tests pass," not "all."

## Builds

Default to `npm run ios` (device build) when an iPhone is detected via `xcrun devicectl list devices`. Otherwise fall back to `npm run ios:sim`.

## Git workflow

- **Branch before editing.** New feature/fix work starts on a fresh branch off `main` (`feat/…`, `fix/…`, `chore/…`, `docs/…`) — never edit on `main`, never defer branching to commit time.
- **Never commit directly to `main`.** Before any commit, re-confirm the current branch is not `main`.
- Never bypass hooks with `--no-verify`. If the pre-commit hook fails, fix the root cause and create a new commit (do not `--amend`).

## Domain model

- **HR source priority:** Watch → BLE HR monitor → bike pulse — the *default* when none is picked. Resolve the **effective** source only through `src/services/hr/hrSource.ts` (`resolveEffectivePrimary` / `resolveEffectiveHrSource`), in every screen, status surface, and the Watch lifecycle. Never branch on the raw stored `primaryHrSource`: it may be unset (`null`) or stale (a forgotten device). Status surfaces must render every source the resolver can return.
- **Calorie source priority:** Watch-computed → HR + profile (Keytel) → power-based → bike-reported.
- **Provider adapter contract:** external upload providers (Strava today, Garmin next) share one interface (`ExportProvider`) for save-and-upload. New providers slot into that contract — don't build parallel paths. Provider-specific failure handling stays behind the seam: a provider classifies its own gear-reconciliation failures via `reconcileGear`, which returns a provider-agnostic `GearReconcileOutcome` (`ok` | `warning` with `linkInvalid` + user message). The upload orchestrator owns only the local provider-gear-link state and the upload state machine — never provider error strings.
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
