# Expo Upgrade Reference

Source: [expo/skills](https://github.com/expo/skills) (official Expo team, MIT license)

## Breaking-Change Audit Surface

- Removed APIs called out in release notes
- Moved modules and replacement import paths
- Native module changes that require prebuild
- Camera, audio, and video features
- Navigation behavior

## Cache Layers

Only relevant when `ios/` or `android/` directories are committed.

| Layer | Purge |
|---|---|
| iOS CocoaPods | `cd ios && pod install --repo-update` |
| Xcode DerivedData | `npx expo run:ios --no-build-cache` |
| Android Gradle | `cd android && ./gradlew clean` |
| JS and Metro | `npx expo export -p ios --clear`, then remove `.expo` or reinstall modules if needed |

## Housekeeping Items

- Release notes for the target SDK version live at `https://expo.dev/changelog`.
- SDK 54+ requires `react-native-worklets`.
- SDK 54+ enables React Compiler via `"experiments": { "reactCompiler": true }`.
- `sdkVersion` in `app.json` is auto-managed and should be removed.
- Remove stale implicit packages such as `@babel/core`, `babel-preset-expo`, and `expo-constants` when they are no longer needed.
- If `babel.config.js` or `metro.config.js` only restates Expo defaults, delete it.

## Deprecated Packages

| Old Package | Replacement |
|---|---|
| `expo-av` | `expo-audio` and `expo-video` |
| `expo-permissions` | Individual package permission APIs |
| `@expo/vector-icons` | `expo-symbols` for SF Symbols |
| `AsyncStorage` | `expo-sqlite/localStorage/install` |
| `expo-app-loading` | `expo-splash-screen` |
| `expo-linear-gradient` | `experimental_backgroundImage` and CSS gradients in `View` |

Update code usage before removing the old package.

## `expo.install.exclude`

Review any `expo.install.exclude` entries in `package.json`. They are usually temporary workarounds that may no longer be needed after the upgrade.

## Metro Notes

- `resolver.unstable_enablePackageExports` is on by default in SDK 53+.
- `experimentalImportSupport` is on by default in SDK 54+.
- `EXPO_USE_FAST_RESOLVER=1` was removed in SDK 54.
- `cjs` and `mjs` extensions are supported by default in SDK 50+.
