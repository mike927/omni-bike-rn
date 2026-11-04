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

Keep the iPhone connected by USB when possible and the Watch nearby. Keep both devices unlocked through installation and log verification, which can take several minutes. If Auto-Lock interrupts the run, temporarily select iOS Settings → Display & Brightness → Auto-Lock → Never, and restore the previous setting afterward. Trust this Mac on the devices. Xcode must be signed in to the correct project team; provisioning renewal can still need network access. The devices must meet the configured deployment targets, and Xcode must support their installed OS versions. Developer-certificate trust on the device, matching provisioning profiles, OS/destination compatibility and continued connectivity are established by the subsequent build/install/launch operations, not guaranteed by this preflight. Metro is not needed or started by these Release commands.

Preflight prints the current stage and device query. A transient device-query timeout or transport reset gets one retry; locked devices, signing failures, unpaired devices, and disabled Developer Mode require their stated corrective action. Detailed compiler and dependency output goes to logs linked from each receipt step. Terminal output contains progress and bounded failure excerpts; inspect the linked log when an excerpt is insufficient.

The shared Watch scheme is checked in. Its default build destination is `generic/platform=watchOS`, which compiles for physical Watch hardware without waiting for a device tunnel. Installation still requires the paired Watch to be unlocked and reachable. `OMNI_WATCH_XCODE_DESTINATION` can override the build destination; `OMNI_WATCH_DEVICE` selects the installation device independently.

A changed native input fingerprint or Xcode/Node version triggers Xcode's `clean` action before building. This cleans compiled products, never the checked-in native project. Native inputs include lockfiles, iOS sources, local modules, config, and plugins.

Each invocation writes a receipt under `logs/releases/`, including source hashes, commit, dirty paths, tool versions, selected devices, configuration, and build/install outcomes. Local `.env` and certificate files are excluded from hashing. An input change during a build stops installation.

After installation, open OmniBike on each requested device, then run `npm run watch:diagnose -- --receipt <receipt.json>`. It captures and attaches native startup evidence to that receipt. Check it with `npm run ios:release:evidence -- <receipt.json>`: `current` describes whether the source still matches; `launchVerified` requires logs from every requested device showing startup and successful WCSession activation after installation. Evidence includes the selected device, bundle ID, capture time and log hash. Missing, modified, mismatched, or pre-installation evidence fails verification. Older receipts containing only a manual `verified` flag or a bare log path need a fresh capture. The check exits nonzero for stale source or unverified startup.

`companionVerified` separately checks that the iPhone's captured log recognizes the paired, installed Watch companion. Successful startup alone does not establish companion detection, live reachability, HR streaming, or ride behavior.

For manual startup, HR, BLE, WatchConnectivity, or background tests, use `ai/skills/manual-test-handoff/SKILL.md`. That procedure owns the handoff and evidence requirements.

## Watch connection recovery

Start with `npm run watch:diagnose`. It reads installed-app identities, device readiness and native WC logs, and inspects available local Release bundle IDs and signing teams. It does not launch apps, install builds, start workouts, or load `.env`. It saves raw logs and a JSON report under `logs/watch-diagnostics/`, and prints a short summary. Device choices follow the Release commands' `OMNI_IOS_DEVICE` / `OMNI_WATCH_DEVICE` overrides; `--phone <device>`, `--watch <device>` and `--output <directory>` override them for one run. With `--receipt`, selections default to that receipt's devices.

The report separates three axes:

| Axis | Evidence | Meaning |
| --- | --- | --- |
| Mac transport | Live device queries | Whether the Mac can inspect each device; a failed Watch tunnel does not establish companion absence |
| Companion detection | Last iPhone `emitCompanionState` entry | `paired && installed` determines app availability; an installed Watch app with `installed=false` indicates a companion-recognition mismatch worth checking |
| Live reachability | Last iPhone reachability entry | Foreground messaging readiness; `false` is normal when an installed companion is idle |

WC state is a captured log observation, not a live OS-property query. Check the report's capture and log-start timestamps; open the apps and repeat if fresh activation evidence is needed. Exit codes are 0 for a log reporting companion availability, 1 for companion unavailability or unverified receipt startup, and 2 when no companion observation is available. A Watch tunnel failure is reported separately even when the iPhone confirms its companion.

For a companion-recognition mismatch, check the report's installed bundle IDs and local built-pair metadata. A matched Release refresh uses `npm run ios:release` for both devices. If a Watch tunnel blocks the combined preflight, recover it first; phone-only followed by Watch-only Release commands can also install the matched pair from the same source. `npm run ios` installs the phone dev client; it does not perform the Release script's separate Watch installation. Re-capture logs to establish whether the refresh resolved detection.

For a Mac-to-Watch transport failure, unlock both devices, confirm Developer Mode, connect the iPhone by USB, and check Device Hub. For a lost Mac pairing, select the Mac and Pair on the Watch's Developer Mode screen. Confirm the requested physical Watch responds before retrying. Signing/trust and OS compatibility errors need their own diagnosis; repeated tunnel retries do not resolve them.
