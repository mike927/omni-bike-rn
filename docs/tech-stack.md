# Tech stack

Version audit: 2026-09-03. The target is the latest mutually compatible stable versions, not independent `latest` tags that break Expo's matrix. Exact installed versions are recorded in `package-lock.json` and `ios/Podfile.lock`.

| Layer | Version / tools |
| --- | --- |
| Mobile runtime | Expo SDK 58.0.23, React Native 0.88.1, React 19.3.0, Hermes V1 |
| Navigation | Expo Router 58.0.30; screen-focus hooks imported from `expo-router` |
| State and data | Zustand 5.0.15, Drizzle ORM 0.45.2 / Kit 0.31.10, Expo SQLite 58.0.15 |
| Animation | Reanimated 4.7.1, Worklets 0.13.0 |
| Hardware | BLE PLX 3.5.1, local Swift Expo modules for HealthKit and WatchConnectivity |
| Language / formatting | TypeScript 6.0.3, Babel 7.29.7, Prettier 3.9.6 |
| Quality | ESLint 9.39.5, Jest 30.5.1, React Native Testing Library 14.0.1, test-renderer 1.2.0 |
| CI | Node 24 LTS, checkout/setup-node v7, Expo GitHub Action v9 |

`.nvmrc` selects Node 24 for local development. Local verification below ran on the existing Node 25.9.0; hosted Node 24 verification runs on PR #106.

## Compatibility decisions

SDK 58 security migration is under review; see [dependency review](audits/2026-11-03-dependencies.md) for current validation and blockers. Earlier SDK 57 device evidence below does not validate this runtime.

- Keep React and React Native on the [Expo SDK 58 matrix](https://expo.dev/changelog/sdk-58). Do not separately upgrade React, Reanimated, Worklets or the native navigation packages beyond that matrix.
- The Expo 58.0.23 update includes the companion-package patch versions recommended by its bundled matrix. `EXPO_OFFLINE=1 npm exec -- expo install --check` reports that dependencies are up to date; the configured Jest exclusions remain intentional.
- React DOM 19.2.3 and Gesture Handler 2.32 satisfy Expo Router's transitive peer dependencies; `@react-native/metro-config` 0.86.3 satisfies Worklets. The old `legacy-peer-deps` setting is removed. Both clean `npm ci` and `npm ls --all` succeed without bypasses.
- TypeScript 7 is outside the installed `@typescript-eslint/typescript-estree` peer range (`<6.1`). TypeScript 6 is the latest compatible major.
- ESLint 10 is outside `eslint-plugin-react`'s supported peer range. ESLint 9 and Unicorn 65 are the latest compatible majors (Unicorn 66+ requires ESLint 10).
- Babel 8 is outside Expo's Babel 7 toolchain requirements.
- Drizzle, BLE PLX and react-native-health were already on their latest stable releases. No database schema or migration changed.
- RNTL 14 replaces the legacy React test renderer and makes rendering/events async. Tests await those operations. ESLint now enforces async `fireEvent`/`userEvent`, replacing the DOM preset's incorrect synchronous-event rule. Existing assertions remain in place.
- Expo's new React Compiler diagnostics (`refs`, `immutability`, `purity`, `set-state-in-effect`) are not enabled as part of this dependency upgrade; adopting the compiler and redesigning the affected native ref patterns is separate work. Existing Hooks checks remain enabled. The new stylistic SonarJS parameterized-test rule is also disabled.

## iOS and Apple Watch

The iOS project is checked in and includes a manually maintained Watch target. Never run `expo prebuild --clean`, or bare `expo prebuild` (clean is the SDK 57 default). Native changes must preserve the Watch target, embedding, signing, bundle identifiers, iPhone product name `omnibikern`, and Watch device family `4`.

Xcode 27 builds require the UIKit scene lifecycle to launch on iOS 27. The app follows [Expo's SDK 57 migration for a hand-managed iOS project](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md#staying-on-sdk-57-with-xcode-27): Expo provides `EXExpoAppSceneDelegate`, and `AppDelegate` supplies its React Native factory through `ExpoReactNativeFactoryProvider`. The scene delegate owns window creation and React Native startup. Keep the scene manifest in both `app.config.ts` and the checked-in `Info.plist`.

`react-native-health` was removed because React Native 0.88 no longer provides its `RCTCallableJSModules#setBridge` API. The existing `apple-health-workout` Expo module now owns profile reads and write-authorization diagnostics as well as authorization, energy queries and workout export. Date of birth is read as calendar components; weight and height use the latest HealthKit samples in kilograms and centimeters. Read failures remain nullable. The standard prebuilt React Native configuration replaces the obsolete source-build compatibility flags. Signed SDK 58 Release builds, installation and standalone startup pass on the physical iPhone and Watch; functional ride and HealthKit verification remains pending.

The app uses a custom development client, not Expo Go. A native rebuild is mandatory after this upgrade. `npm run build:smoke` only exports both JavaScript bundles and intentionally does not regenerate the native project.

The splash plugin uses its supported `enableFullScreenImage_legacy` option to preserve the previous full-screen aspect-fit layout. Regenerated PNGs have identical dimensions and pixel data to the original assets.

## Verification

Verified on the previous SDK 57 runtime on 2026-11-03 after adopting the scene lifecycle and aligning Expo's companion-package patches:

- Expo 57.0.31 and its updated pods compile in Debug and Release for the physical iPhone 16 Pro and Apple Watch Ultra 2 targets, using the iPhoneOS 27.2 and watchOS 27.2 SDKs. A clean Xcode build replaces the stale embedded ExpoModulesJSI framework left by the previous dependency versions.
- The exact `npm run ci:gate` passes in a clean snapshot of the tracked files: lint, TypeScript, and 117 test suites / 1204 tests. The snapshot uses the installed dependencies and excludes local worktrees and generated build products.
- `npm run build:smoke` exports iOS and Android successfully. `npm ls --all` reports no dependency problems, and an isolated `npm ci --dry-run --offline --ignore-scripts --no-audit` validates the lockfile without reinstalling dependencies. The native Watch lifecycle checks and plist validation also pass.
- With Metro stopped, the iPhone displays Home, backgrounds, and reopens successfully. Native logs show `appEntersBackground`, followed by `appEntersForeground` and `appBecomesActive`.
- Companion presence is confirmed by `emitCompanionState available=true paired=true installed=true activationState=2 reachable=false`; Home shows Apple Watch as Ready.
- The Release companion is installed on the physical Apple Watch Ultra 2 and displays `Waiting for ride` / `Start on iPhone`.

These checks establish standalone startup and companion presence. They do not replace the ride, BLE, HealthKit, and HR transport checks below.

Verified locally on 2026-09-04:

- Clean `npm ci` without legacy peer resolution; `npm ls --all` exits successfully.
- Online `expo install --check`: versions are up to date against the supported matrix.
- `npm run ci:gate`: lint, TypeScript, 107 suites / 1016 tests pass after the HR status clarification; process exits successfully.
- Additional full test run with `--detectOpenHandles`: 1009 tests pass, no open handles reported. One earlier run printed the one-second shutdown warning but exited successfully; the final normal run did not reproduce it.
- `npm run db:check` and `git diff --check` pass.
- JavaScript export succeeds for both iOS and Android. Android native/cloud build was not run.
- iOS simulator build succeeds. Physical iPhone + embedded Watch Debug build succeeds after Xcode renews development provisioning profiles.
- Both physical-device app bundles pass `codesign --verify --deep --strict` against the system trust store.
- iPhone app installation completes. After the user trusts the developer profile, launch succeeds and Metro serves the current bundle (2166 modules). The prior iOS launch/security blocker is resolved.
- After the user re-establishes the Watch connection in Xcode, explicit Watch installation and launch both succeed. The prior CoreDevice pairing blocker is resolved.
- Fresh iPhone evidence at 07:09:23: `sessionWatchStateDidChange paired=true installed=true`, then `emitCompanionState available=true paired=true installed=true activationState=2 reachable=false`. Watch evidence: `activationDidCompleteWith state=2 error=nil reachable=false`. Both apps recognize an installed companion; live workout/HR transport still needs the physical test below.

The user confirmed the HR label device test. Logs pulled after that confirmation also prove a short Watch workout starts, delivers HR through workout mirroring, and ends:

| Check | Result | Evidence (2026-09-04, device time) |
| --- | --- | --- |
| Watch session starts | Pass | `07:29:45.244 didReceiveApplicationContext sessionState=started` |
| Phone receives Watch HR | Pass | `07:29:53.032 mirrored workoutSession didReceiveDataFromRemoteWorkoutSession hr=88` (four samples received through 07:30:07) |
| Watch session ends | Pass | `07:30:11.406 didReceiveApplicationContext sessionState=ended` |

Physical-device BLE, Apple Health save, pause/resume and extended background checks remain pending; this short log does not establish those behaviors. See [device verification handoff](./tech-stack-device-check.md). Native builds and unit tests cannot prove these transports work. Those pending checks are now specified, together with the device-only residual of the 2026-09-05 audit remediation, in the [consolidated device verification pass](./audits/2026-09-05/device-verification.md), which supersedes the older handoff above for this round.

## Known upstream diagnostics

On the previous SDK 57 runtime, Expo Doctor reported two known issues:

- `react-native-health` brings an old `@expo/config-plugins` tree with `@expo/fingerprint` 0.6.1 alongside Expo's 0.20.12. This is build tooling, not a second runtime module. The old forced fingerprint override was removed; forcing a new major into the legacy plugin tree is not a supported repair.
- App config/native-directory synchronization: intentional because iOS is checked in while Android is generated. EAS does not automatically apply app-config changes to the checked-in iOS project.

Neither warning is hidden; Expo Doctor reports 19/21 checks passing.

Online lockfile audits on 2026-11-03 report 72 findings on `main` (1 low, 60 moderate, 10 high, 1 critical) and 69 after this Expo patch (1 low, 60 moderate, 7 high, 1 critical). No new vulnerable package names or advisory IDs were detected; the patch removes the `compression`, `node-forge`, and `source-map-js` findings. Both lockfiles retain the critical [shell-quote command-injection advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv). This is not a clean security audit. Remaining dependency remediation is tracked in the roadmap; no forced major override or audit-suggested SDK upgrade was applied.
