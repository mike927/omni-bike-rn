# AGENTS.md — omni-bike-rn

Primary operating contract for any AI coding agent working on this project. Tool-agnostic by default; per-tool overlays (e.g. `CLAUDE.md`) cover tool-specific quirks only. If an overlay contradicts this file, this file wins.

## Project identity

Indoor cycling companion app. React Native / Expo, TypeScript, Drizzle + expo-sqlite, BLE FTMS (heart rate + trainer), Apple Health, Apple Watch companion via WatchConnectivity.

## Workflow

For dependency upgrades or device builds, follow [verification workflow](docs/development-verification.md). Use the skills declared in `skills-lock.json` and `ai/skills/` for their matching tasks.

## Skill management

- External skills are declared in `skills-lock.json`.
- Custom repo-owned skills live in `ai/skills/**`.
- Agent discovery directories under tool-owned skill folders are generated; don't edit or commit skill files there.
- Run `npm run skills:install` after changing `skills-lock.json` or adding/removing a custom skill.
- Editing an existing `ai/skills/**` file does not require reinstall; restart or reload the agent session if it does not pick up the change.

## Engineering principles

- **Canonical over clever.** Implement the recommended, documented approach — no workarounds, monkey-patches, or one-off shims.
- **Rebuild over patch.** When a structure is wrong (e.g. status management), redesign it cleanly — even from scratch — rather than layering fixes on the broken shape.
- **Simplest thing that holds.** No speculative abstraction or premature generality; solve the case in front of you.
- **Feasible on real transport.** Confirm a design works over the actual watch ↔ app ↔ bike connectivity before building it.
- **Idempotent teardown.** Release a resource by whether it exists, not by the current value of a mutable input that may have drifted since acquisition.

## Icons & assets

- Never hand-author or approximate icon SVG path data. Fetch the real SVG from a license-clean free set and use it as-is.
- Icon sources: Ionicons (RN app), Streamline (onboarding), or Lucide / Feather / Tabler / Heroicons.
- Mockups follow the same rule.

## Roadmap

Active work tracked in `ROADMAP.md`. Update states (`[ ] [~] [x] [-]`) as work progresses. Unresolved or exploratory items live in its **Future Considerations** section at the bottom.

## Dev loop

Run scripts via `npm run <name>` — see `package.json` for the full list. The ones worth knowing by name: `ci:gate` (lint + typecheck + tests, the pre-ship gate) and `db:generate` / `db:check` (Drizzle migrations).

**Tests (dev loop):** run `npm run test:changed` (`jest --changedSince=main` — branch-affected tests only); the full `npm test` is CI's job (`ci:gate`). A green run means "changed tests pass," not "all."

**Metro:** one instance on `:8081`; check `lsof -i :8081` before acting and reuse a running one, never trust memory about its state. Start it with `npm start` as a long-running process the user can see and stop. Reload connected apps with `npm run metro:reload`, open their dev menu with `npm run metro:menu`. Restart = stop the process, then `npm start`; an orphan on `:8081` gets its PID killed.

**Native lifecycle checks:** `npm run test:watch-lifecycle` compiles the Watch companion's pure lifecycle model together with the host checks in `native-tests/` and runs them on the Mac. Deliberately outside `ci:gate`, which runs on Linux with no Swift toolchain; `lint-staged` runs it pre-commit for staged `ios/OmniBikeWatch Watch App/*.swift`. Run it by hand after any other change that touches the lifecycle.

## Builds

Default to `npm run ios` (device build) when an iPhone is detected via `xcrun devicectl list devices`. Otherwise fall back to `npm run ios:sim`.

For a standalone on-device build with no Metro server (Release config), use `npm run ios:release`.

## Git workflow

- **Branch before editing.** New feature/fix work starts on a fresh branch off `main` (`feat/…`, `fix/…`, `chore/…`, `docs/…`) — never edit on `main`, never defer branching to commit time.
- **Never commit directly to `main`.** Before any commit, re-confirm the current branch is not `main`.
- Never bypass hooks with `--no-verify`. If the pre-commit hook fails, fix the root cause and create a new commit (do not `--amend`).
- **After a PR merges, clean up:** delete its branch (local + remote) and worktree, then switch the working copy back to `main`.

## Domain model

Before changing HR, rides, BLE, Watch lifecycle, persistence, uploads, or app boot, read [domain contracts](docs/domain-model.md).

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
- **Filled tool-specific overlay files** — placeholders only; populate when those tools are actually used.

Custom project skills and slash commands are welcome if a real gap appears that no marketplace plugin fills — the harness supports them.
