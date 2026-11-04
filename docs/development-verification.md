# Development verification

Use Node 24 (`fnm use`, `nvm use`, or your version manager's equivalent). CI reads `.nvmrc`.

## Dependency changes

1. Install with `npm ci` after changing the lockfile.
2. Run `npm run check:dependencies` before native builds. It checks the installed Expo matrix without loading local environment files and validates the installed dependency tree. The bundled matrix check is deterministic; it does not query for new releases.
3. Run `npm run ci:gate` and `npm run build:smoke` against the final files. Local worktrees, Pods, and generated build output are excluded from lint.
4. Run `npm run audit:report` with network access. Reports go to `logs/audits/`; missing network access fails the command. The summary groups underlying advisories and dependency paths. The command fails for high/critical advisories; `-- --baseline <saved-summary.json>` checks for new high/critical advisory/severity pairs while retaining all existing findings in the output. An accepted baseline is not a security fix.

Inspect summaries before full dependency trees. Save verbose build and package-manager output to a log, then read the relevant failure or final result.

## Physical Release builds

Run `npm run ios:release` (both devices), `ios:release:phone`, or `ios:release:watch`. The command prints Node/Xcode versions, destinations and the DerivedData directory before building. Device discovery does not imply readiness: an unavailable or locked device can still prevent the subsequent build/install.

Run `npm run ios:release:check` to check prerequisites without building or installing. For one device, use `npm run ios:release:phone -- --check` or `npm run ios:release:watch -- --check`. The same preflight runs automatically before every Release build and saves its outcome in the release receipt.

| Prerequisite | Automatic check / action |
| --- | --- |
| Node 24.3+ on the 24 line; healthy installed dependency tree aligned with Expo | Dependency validation; run `npm ci` after lockfile changes |
| Full Xcode selected, initial setup and license completed | `xcodebuild -version`; select the full Xcode installation with `xcode-select` |
| Installed Pods match `ios/Podfile.lock` | Compare `Pods/Manifest.lock`; run `cd ios && pod install --no-repo-update` when missing or stale |
| Checked-in workspace and requested shared schemes exist | Query Xcode schemes; restore missing checked-in native files without clean prebuild |
| Valid code-signing identity in the keychain | Query valid signing identities; configure the project team in Xcode → Settings → Accounts |
| Requested physical devices paired with this Mac; Developer Mode enabled | Query each requested device; after enabling Developer Mode, restart and confirm Turn On |
| Requested devices unlocked and reachable | Live lock-state query with a 15-second timeout; unlock and keep awake until installation finishes |

Keep the iPhone connected by USB when possible and the Watch nearby. Trust this Mac on the devices. Xcode must be signed in to the correct project team; provisioning renewal can still need network access. The devices must meet the configured deployment targets, and Xcode must support their installed OS versions. Developer-certificate trust on the device, matching provisioning profiles, OS/destination compatibility and continued connectivity are established by the subsequent build/install/launch operations, not guaranteed by this preflight. Metro is not needed or started by these Release commands.

The shared Watch scheme is checked in. Its default build destination is `generic/platform=watchOS`, which compiles for physical Watch hardware without waiting for a device tunnel. Installation still requires the paired Watch to be unlocked and reachable. `OMNI_WATCH_XCODE_DESTINATION` can override the build destination; `OMNI_WATCH_DEVICE` selects the installation device independently.

A changed native input fingerprint or Xcode/Node version triggers Xcode's `clean` action before building. This cleans compiled products, never the checked-in native project. Native inputs include lockfiles, iOS sources, local modules, config, and plugins.

Each invocation writes a receipt under `logs/releases/`, including source hashes, commit, dirty paths, tool versions, selected devices, configuration, and build/install outcomes. Local `.env` and certificate files are excluded from hashing. An input change during a build stops installation.

Check an existing receipt with `npm run ios:release:evidence -- <receipt.json>`. `current` describes whether its source still matches. `launchVerified` remains false until every requested device has been checked on hardware. Record `launches.phone` / `launches.watch` as `verified` only with the corresponding device log evidence; retain that evidence alongside the receipt. Successful installation alone does not establish startup or transport behavior.

For manual startup, HR, BLE, WatchConnectivity, or background tests, use `ai/skills/manual-test-handoff/SKILL.md`. That procedure owns the handoff and evidence requirements.

## Watch connection recovery

If the Watch is unavailable, unlock both devices, confirm Developer Mode, connect the iPhone by USB, and check Device Hub. For a lost Mac pairing, select the Mac and Pair on the Watch's Developer Mode screen. Confirm the requested physical Watch is available before retrying. Signing/trust and OS compatibility errors need their own diagnosis; repeated tunnel retries do not resolve them.
