# AGENTS.md — omni-bike-rn

Primary operating contract for any AI coding agent working on this project. Tool-agnostic by default; per-tool overlays (e.g. `CLAUDE.md`) cover tool-specific quirks only. If an overlay contradicts this file, this file wins.

## Project identity

Indoor cycling companion app. React Native / Expo, TypeScript, Drizzle + expo-sqlite, BLE FTMS (heart rate + trainer), Apple Health, Apple Watch companion via WatchConnectivity.

## Workflow

superpowers is the workflow core — don't invent parallel flows.

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

## Builds

Default to `npm run ios` (device build) when an iPhone is detected via `xcrun devicectl list devices`. Otherwise fall back to `npm run ios:sim`.

For a standalone on-device build with no Metro server (Release config), use `npm run ios:release`.

## Git workflow

- **Branch before editing.** New feature/fix work starts on a fresh branch off `main` (`feat/…`, `fix/…`, `chore/…`, `docs/…`) — never edit on `main`, never defer branching to commit time.
- **Never commit directly to `main`.** Before any commit, re-confirm the current branch is not `main`.
- Never bypass hooks with `--no-verify`. If the pre-commit hook fails, fix the root cause and create a new commit (do not `--amend`).
- **After a PR merges, clean up:** delete its branch (local + remote) and worktree, then switch the working copy back to `main`.

## Domain model

- **HR source priority:** Watch → BLE HR monitor — the *default* when none is picked. Watch **candidacy is platform-based** (`isAppleWatchAvailable`), NOT live readiness — a watch-capable iPhone keeps Watch as the default even while the companion is currently `unavailable` (readiness is a separate axis: `watchHrStatus` / `hrSourceIdleReadiness`). The resolvers are **nullable** only when no source can exist: no watch *platform* + no saved strap → `null`, surfaced as "Heart rate · Not set up". The bike is **not** an HR source (it still reports power/cadence/calories). Resolve the **effective** source only through `src/services/hr/hrSource.ts` (`resolveEffectivePrimary` / `resolveEffectiveHrSource`, both `HrSource | null`), in every screen, status surface, and the Watch lifecycle. Never branch on the raw stored `primaryHrSource`: it may be unset (`null`) or stale (a forgotten device); sanitize loaded values through `isHrSource`. Status surfaces must render every source the resolver can return, including the no-source state. Assemble the resolver inputs only through `src/services/hr/useEffectiveHrSource.ts` (`useEffectiveHrSource` / `useEffectivePrimary` in components, `getEffectiveHrSource` in services) — don't re-read the three stores at call sites.
- **Device-status vocabulary:** the app-wide `DeviceStatus` type + labels/tones live in `src/types/deviceStatus.ts` (shared seam); UI and services import it from there — UI must not reach into the services layer for it. `DESIGN.md` is the canonical label/tone reference; keep them in sync.
- **Calorie source priority:** Watch-computed → HR + profile (Keytel) → power-based → bike-reported. The Watch tier's cumulative active-kcal stream is an optional capability of the HR adapter contract (`HrAdapter.subscribeToActiveKcal?`), implemented by `WatchHrAdapter`; non-calorie sources omit it.
- **Session accumulation:** the live 1 Hz tick computation is a pure reducer, `advanceSession(state, input)` in `src/services/training/sessionAccumulator.ts`. `trainingSessionStore` delegates each active tick to it — never re-inline tick logic in the store. Keep it in sync with the calorie-priority rule above.
- **Session ownership:** a ride is global and outlives every screen. The single `MetronomeEngine`, the session's *reaction* to bike status and to a bike drop (freeze the ride) and the Watch remote (`useWatchRideRemote`, so on-wrist Pause/Resume/End keep working after Back) belong to `useTrainingSessionLifecycle`, mounted exactly once from the app-boot hook; the commands and the in-flight teardown state live in `src/features/training/sessionController.ts`. The transport observer that produces the drop lives at the connection owner (next bullet), not here. Screens mount `useTrainingSession`, which is effect-free: mounting it starts nothing and unmounting it stops nothing. Never give a screen its own engine or session lifecycle effect.
- **BLE transport loss:** observed natively at the connection owner (`useDeviceConnection`) via `bleManager.onDeviceDisconnected`, one observer per role, identity-guarded against the adapter instance it was registered for. Sample silence never implies disconnection at this layer; `useTrainingSessionLifecycle`'s bike telemetry watchdog is a separate, deliberate exception. A deliberate teardown disarms the observer for the role(s) it is about to cancel before cancelling anything: a single-role teardown (`disconnectBike`, `disconnectHr`) disarms only its own role; an all-role teardown (`disconnectAllDeviceConnections`, `runResetSessionAndConnections`) disarms every role up front, because cancelling one role's connection can take seconds during which a drop on the other role must not be handled as unexpected.
- **Reconnect ownership:** auto-reconnect policy is global, exactly like the ride. The probe budget (3 probes: immediate, +3 s, +5 s), the retry timers and the in-flight attempt state live in `src/features/gear/reconnectController.ts`, reconciled by `useAutoReconnectLifecycle`, mounted exactly once from the app-boot hook. Screens mount `useAutoReconnect`, which is effect-free: it reads the reconnect state the saved-gear store already publishes and forwards `retryBike` / `retryHr`. Never give a screen its own reconnect effect, timer or attempt counter, because one cycle has to behave the same whichever screens happen to be mounted. Bike and strap keep separate runtime records, so spending one role's budget never spends the other's. Connecting and disconnecting a role stay at the connection owner (`connectBikeDevice` / `connectHrDevice` / `disconnectBikeDevice` / `disconnectHrDevice`), so screens and the reconnect owner share one implementation.
- **Ride persistence outcome:** the ride's durable state belongs to the lifecycle, not to a fire-and-forget write. `useTrainingSessionPersistence` reports it through `useSessionPersistenceStore`; `finishSessionAndDisconnect` awaits it and returns `completed` or `unsaved`. An `unsaved` ride keeps its identity, its memory state and its connections until `retryFinishSave` succeeds or the user calls `discardUnsavedSession`: never tear down or navigate on a failed save. A discard always drops the ride from memory, but reports `failed` when the row delete throws, so the leftover row is disclosed instead of silently coming back as an interrupted ride. Failed sample writes are counted and dropped, never buffered.
- **Provider adapter contract:** external upload providers (Strava today, Garmin next) share one interface (`ExportProvider`) for save-and-upload. New providers slot into that contract — don't build parallel paths. Provider-specific failure handling stays behind the seam: a provider classifies its own gear-reconciliation failures via `reconcileGear`, which returns a provider-agnostic `GearReconcileOutcome` (`ok` | `warning` with `linkInvalid` + user message). The upload orchestrator owns only the local provider-gear-link state and the upload state machine — never provider error strings.
- **Upload recovery:** in the upload state machine `uploading` means *live in this process*. `uploadOrchestrator` tracks its own in-flight uploads; a row still `uploading` at boot (swept by `useAppInitialization`), or one no live operation owns, was abandoned by a killed process and becomes `interrupted`. An interrupted attempt is never silently resent and never silently failed, because whether the provider accepted the ride is genuinely unknown; only the user settles it, by resending (`resendInterruptedUpload`) or by confirming the ride is already there (`acknowledgeInterruptedUpload`). A resend the user asked for that then fails goes back to `interrupted`, never to `failed`, because a failed resend says nothing about whether the earlier attempt reached the provider, and a `failed` row is claimable by a plain retry that would warn nobody. Recovery stays provider-agnostic: no provider error string, and no provider call, decides it.
- **Provider-gear-link persistence:** link list and identity logic lives only in `src/services/providerGear/providerGearLinkStorage.ts`. `useProviderGearLinkStore` re-derives from it after each write — don't reimplement link matching in the store.
- **App boot:** store hydration, provider registration, DB init/retry, and global lifecycle hooks live in `src/bootstrap/useAppInitialization.ts`, which returns an `AppInitState`. `app/_layout.tsx` only renders against that state — add new boot work to the hook, not the layout.
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
- **Filled tool-specific overlay files** — placeholders only; populate when those tools are actually used.

Custom project skills and slash commands are welcome if a real gap appears that no marketplace plugin fills — the harness supports them.
