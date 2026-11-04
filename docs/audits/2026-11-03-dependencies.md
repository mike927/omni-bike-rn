# Dependency security review — 2026-11-03

This branch merges main at `caa1fc0` and moves the app to the [supported SDK 58 matrix](https://expo.dev/changelog/sdk-58): Expo 58.0.23, React Native 0.88.1, React 19.3.0, and matching Expo/native companion packages. Node 24 is required by the project verification workflow.

## Changes reviewed

- SDK 58 removes vulnerable Router query decoding and the older CLI's Zod dependency chain. The lockfile also refreshes compatible transitive fixes, including shell-quote and brace-expansion.
- Scoped npm overrides update legacy esbuild and XML tooling, modern glob/minimatch consumers, and Xcode's project parser. Legacy minimatch 3 consumers retain their callable API; forcing minimatch 11 into those callers would break lint/coverage tooling. The [Xcode 4 release](https://github.com/apache/cordova-node-xcode/blob/master/RELEASENOTES.md) replaces UUID with Node's built-in generator; its engine requirement is covered by Node 24.
- `File.write()` is asynchronous in SDK 58. Upload file creation and diagnostic appends use `writeSync()` to preserve synchronous behavior. The upload test uses the actual shared fixture rather than Jest's auto-mocked fixture exports and checks the TCX content at the HTTP boundary. It fails with the old asynchronous call and passes with `writeSync`.
- Nullable tab icon colors use the configured active/inactive theme fallback. Reconnect state accepts the native API's initially nullable AppState value without changing the foreground predicate. The icon fixture uses `ViewProps` instead of the old View class shape.
- Jest uses the SDK 58 Expo preset and the documented Reanimated resolver/setup so native Expo modules and animation web implementations initialize correctly in tests.
- CocoaPods is updated from the installed package podspecs, preserving both native targets. The generated project adds React Native's localization resource bundle.

## Audit result

Fresh online audit after main integration: **48 findings: 6 low, 42 moderate, 0 high, 0 critical**. These are propagated package findings from two underlying advisories, not 48 distinct vulnerabilities. Main's previous SDK 57 comparison had 69 findings including one critical.

| Remaining advisory | Constraint |
| --- | --- |
| [deepmerge prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | The current upstream release has no patched version. Jest still depends on it. |
| [minimatch pattern amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) | The patched major removes the callable/default export and regex APIs still used by legacy lint and coverage consumers. Modern consumers are upgraded separately. |

No advisory is suppressed and this is not a zero-vulnerability result. `npm run audit:report` retains all findings. Baseline acceptance is not used to claim remediation.

## Validation at MR #123 merge

- Clean Node 24 install, installed Expo matrix, and npm dependency tree pass.
- The upload regression test passes after a verified red/green cycle.
- iOS and Android bundle exports and Drizzle migration checks pass.
- Full quality gate passes: lint, TypeScript, three tooling checks, and 117 suites / 1,205 tests. Unsigned Release compilation for physical device architectures **fails** in `react-native-health/RCTAppleHealthKit/RCTAppleHealthKit.m:844`: `RCTCallableJSModules` no longer declares `setBridge:` in React Native 0.88.1. The older source-build compatibility flags do not restore this API. This is a merge blocker; the HealthKit integration must migrate to a supported implementation before shipping SDK 58. No dependency source is patched.
- No SDK 58 app has been installed or launch-verified on the physical iPhone/Watch. SDK 57 startup evidence does not establish SDK 58 behavior.

## Native build follow-up — 2026-11-04

The existing local `apple-health-workout` Expo module now handles the four profile reads and write-authorization diagnostics. `react-native-health` and its compatibility flags are removed. The signed iPhone Release build and the physical-hardware Watch Release build both pass. The shared Watch scheme is checked in; its build uses `generic/platform=watchOS` so compilation does not require an active device tunnel. Installation and runtime checks still require connected physical devices.

The migration and release preflight pass the full quality gate (117 suites / 1,218 tests), including profile reads with no legacy module present. The Watch destination regression test separately reproduces the old physical-device build destination and passes with the generic hardware destination. No dependency source is patched.

Phone-only, Watch-only and combined Release commands built and installed on the physical iPhone 16 Pro and Apple Watch Ultra 2. Both apps launched with Metro stopped; the user confirmed the normal Home and waiting-for-ride screens remain open. Fresh native logs confirm companion presence and Watch activation. The preflight also passed on both devices and rejected a locked iPhone before building. These checks establish standalone startup; profile import, ride telemetry and workout export still need functional device checks.
