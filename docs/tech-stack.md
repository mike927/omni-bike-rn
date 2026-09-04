# Tech stack

Version audit: 2026-09-03. The target is the latest mutually compatible stable versions, not independent `latest` tags that break Expo's matrix. Exact installed versions are recorded in `package-lock.json` and `ios/Podfile.lock`.

| Layer | Version / tools |
| --- | --- |
| Mobile runtime | Expo SDK 57.0.19, React Native 0.86.3, React 19.2.3, Hermes V1 |
| Navigation | Expo Router 57.0.18; screen-focus hooks imported from `expo-router` |
| State and data | Zustand 5.0.15, Drizzle ORM 0.45.2 / Kit 0.31.10, Expo SQLite 57.0.2 |
| Animation | Reanimated 4.5.1, Worklets 0.10.1 |
| Hardware | BLE PLX 3.5.1, react-native-health 1.19.0, local Swift Expo modules for workout export and WatchConnectivity |
| Language / formatting | TypeScript 6.0.3, Babel 7.29.7, Prettier 3.9.6 |
| Quality | ESLint 9.39.5, Jest 30.5.1, React Native Testing Library 14.0.1, test-renderer 1.2.0 |
| CI | Node 24 LTS, checkout/setup-node v7, Expo GitHub Action v9 |

`.nvmrc` selects Node 24 for local development. Verification below ran on the existing local Node 25.9.0; hosted CI was not dispatched.

## Compatibility decisions

- Keep React and React Native on the [Expo SDK 57 matrix](https://expo.dev/changelog/sdk-57). Do not separately upgrade React, Reanimated, Worklets or the native navigation packages beyond that matrix.
- React DOM 19.2.3 and Gesture Handler 2.32 satisfy Expo Router's transitive peer dependencies; `@react-native/metro-config` 0.86.3 satisfies Worklets. The old `legacy-peer-deps` setting is removed. Both clean `npm ci` and `npm ls --all` succeed without bypasses.
- TypeScript 7 is outside the installed `@typescript-eslint/typescript-estree` peer range (`<6.1`). TypeScript 6 is the latest compatible major.
- ESLint 10 is outside `eslint-plugin-react`'s supported peer range. ESLint 9 and Unicorn 65 are the latest compatible majors (Unicorn 66+ requires ESLint 10).
- Babel 8 is outside Expo's Babel 7 toolchain requirements.
- Drizzle, BLE PLX and react-native-health were already on their latest stable releases. No database schema or migration changed.
- RNTL 14 replaces the legacy React test renderer and makes rendering/events async. Tests await those operations. ESLint now enforces async `fireEvent`/`userEvent`, replacing the DOM preset's incorrect synchronous-event rule. Existing assertions remain in place.
- Expo's new React Compiler diagnostics (`refs`, `immutability`, `purity`, `set-state-in-effect`) are not enabled as part of this dependency upgrade; adopting the compiler and redesigning the affected native ref patterns is separate work. Existing Hooks checks remain enabled. The new stylistic SonarJS parameterized-test rule is also disabled.

## iOS and Apple Watch

The iOS project is checked in and includes a manually maintained Watch target. Never run `expo prebuild --clean`, or bare `expo prebuild` (clean is the SDK 57 default). Native changes must preserve the Watch target, embedding, signing, bundle identifiers, iPhone product name `omnibikern`, and Watch device family `4`.

`react-native-health` 1.19 calls `RCTCallableJSModules#setBridge`, which is absent from React Native's default precompiled core. The Podfile uses the [official source-build compatibility flags](https://reactnative.dev/blog/2026/02/11/react-native-0.84): `RCT_USE_PREBUILT_RNCORE=0` and `RCT_REMOVE_LEGACY_ARCH=0`. This retains the compatibility API while continuing to run the New Architecture. The first native build takes longer. No dependency source is patched.

The app uses a custom development client, not Expo Go. A native rebuild is mandatory after this upgrade. `npm run build:smoke` only exports both JavaScript bundles and intentionally does not regenerate the native project.

The splash plugin uses its supported `enableFullScreenImage_legacy` option to preserve the previous full-screen aspect-fit layout. Regenerated PNGs have identical dimensions and pixel data to the original assets.

## Verification

Verified locally on 2026-09-04:

- Clean `npm ci` without legacy peer resolution; `npm ls --all` exits successfully.
- Online `expo install --check`: versions are up to date against the supported matrix.
- `npm run ci:gate`: lint, TypeScript, 107 suites / 1009 tests pass; process exits successfully.
- Additional full test run with `--detectOpenHandles`: 1009 tests pass, no open handles reported. One earlier run printed the one-second shutdown warning but exited successfully; the final normal run did not reproduce it.
- `npm run db:check` and `git diff --check` pass.
- JavaScript export succeeds for both iOS and Android. Android native/cloud build was not run.
- iOS simulator build succeeds. Physical iPhone + embedded Watch Debug build succeeds after Xcode renews development provisioning profiles.
- Both physical-device app bundles pass `codesign --verify --deep --strict` against the system trust store.
- iPhone app installation completes. After the user trusts the developer profile, launch succeeds and Metro serves the current bundle (2166 modules). The prior iOS launch/security blocker is resolved.
- After the user re-establishes the Watch connection in Xcode, explicit Watch installation and launch both succeed. The prior CoreDevice pairing blocker is resolved.
- Fresh iPhone evidence at 07:09:23: `sessionWatchStateDidChange paired=true installed=true`, then `emitCompanionState available=true paired=true installed=true activationState=2 reachable=false`. Watch evidence: `activationDidCompleteWith state=2 error=nil reachable=false`. Both apps recognize an installed companion; live workout/HR transport still needs the physical test below.

Physical-device BLE, Apple Health and WatchConnectivity checks remain pending. See [device verification handoff](./tech-stack-device-check.md). Native builds and unit tests cannot prove these transports work.

## Known upstream diagnostics

Expo Doctor reports two known issues at this stage:

- `react-native-health` brings an old `@expo/config-plugins` tree with `@expo/fingerprint` 0.6.1 alongside Expo's 0.20.12. This is build tooling, not a second runtime module. The old forced fingerprint override was removed; forcing a new major into the legacy plugin tree is not a supported repair.
- App config/native-directory synchronization: intentional because iOS is checked in while Android is generated. EAS does not automatically apply app-config changes to the checked-in iOS project.

Neither warning is hidden; Expo Doctor reports 19/21 checks passing.

`npm audit` reports 22 affected packages (21 moderate, 1 high; no critical). The high finding is the old `@xmldom/xmldom` in react-native-health's build-plugin dependency tree. Other findings include Drizzle's legacy esbuild tooling and Expo Router's query-string dependency. These are not a clean security audit. No forced major override or audit-suggested downgrade was applied; updating/replacing the upstream dependencies is follow-up work.
