---
name: expo-upgrade
description: Guidelines for upgrading Expo SDK versions, fixing dependency issues, and handling breaking changes during SDK migrations.
---

# Expo SDK Upgrade

Source: [expo/skills](https://github.com/expo/skills) (official Expo team, MIT license)

## Upgrade Shape

An SDK upgrade touches three surfaces in this order: JS dependencies, native directories (if present), then caches. The canonical commands for each:

| Surface | Command(s) |
|---|---|
| Dependencies | `npx expo install expo@latest` + `npx expo install --fix` |
| Diagnostics | `npx expo-doctor` |
| JS/Metro caches | `npx expo export -p ios --clear` + `rm -rf node_modules .expo` + `watchman watch-del-all` |
| Native regen (bare workflow only) | `npx expo prebuild --clean` |

**Whether a prebuild is needed depends on the repo shape.** Projects with no `ios/` or `android/` directories use Continuous Native Generation — the native projects are regenerated at build time and the prebuild step is skipped. Projects with committed native directories (partial eject) must prebuild when native modules change, but destructive `--clean` is unsafe if any native target is manually maintained (e.g., a watchOS companion target) — repo-specific rules override the generic command.

## Breaking Changes — Audit Surface

- Removed APIs called out in release notes.
- Moved modules and their new import paths.
- Native module changes that require a prebuild.
- Camera, audio, and video features (frequent churn area).
- Navigation behavior.

## Bare-Workflow Cache Layers

Only relevant when `ios/` or `android/` directories are committed. Each layer has its own cache to purge when things stop behaving:

| Layer | Purge |
|---|---|
| iOS Cocoapods | `cd ios && pod install --repo-update` |
| Xcode DerivedData | `npx expo run:ios --no-build-cache` |
| Android Gradle | `cd android && ./gradlew clean` |

## Housekeeping Items

- Release notes for the target SDK version live at `https://expo.dev/changelog`.
- SDK 54+ requires `react-native-worklets` (dependency of `react-native-reanimated`).
- SDK 54+ enables React Compiler via `"experiments": { "reactCompiler": true }` in `app.json`.
- `sdkVersion` in `app.json` is auto-managed — delete it.
- Implicit packages in `package.json` that should be removed: `@babel/core`, `babel-preset-expo`, `expo-constants`.
- If `babel.config.js` only contains `babel-preset-expo`, delete the file.
- If `metro.config.js` only contains Expo defaults, delete the file.

## Deprecated Packages

| Old Package          | Replacement                                          |
| -------------------- | ---------------------------------------------------- |
| `expo-av`            | `expo-audio` and `expo-video`                        |
| `expo-permissions`   | Individual package permission APIs                   |
| `@expo/vector-icons` | `expo-symbols` (for SF Symbols)                      |
| `AsyncStorage`       | `expo-sqlite/localStorage/install`                   |
| `expo-app-loading`   | `expo-splash-screen`                                 |
| expo-linear-gradient | experimental_backgroundImage + CSS gradients in View |

When migrating deprecated packages, update all code usage before removing the old package.

## expo.install.exclude

Check if package.json has excluded packages:

```json
{
  "expo": { "install": { "exclude": ["react-native-reanimated"] } }
}
```

Exclusions are often workarounds that may no longer be needed after upgrading. Review each one.

## Metro

Remove redundant metro config options:

- resolver.unstable_enablePackageExports is enabled by default in SDK +53
- `experimentalImportSupport` is enabled by default in SDK +54
- `EXPO_USE_FAST_RESOLVER=1` is removed in SDK +54
- cjs and mjs extensions are supported by default in SDK +50

## New Architecture

The new architecture is enabled by default. The app.json field `"newArchEnabled": true` is no longer needed as it's the default. Expo Go only supports the new architecture as of SDK +53.
