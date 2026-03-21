---
name: ios-native
description: Use this skill for iOS-specific app behavior, native integration, background modes, and Apple platform features in this repo.
---
# iOS Native

Use this skill when the task is specifically about iOS behavior or Apple platform integration.

## Current State

- **Expo SDK 54** with New Architecture (JSI) enforced
- **expo-router** for file-based navigation
- iOS is the **primary and only target** for the MVP

## Planned Integrations

### Live Activities & Dynamic Island (Phase 2)

- Package: `react-native-activity-kit`
- Surface live training metrics (speed, HR, time) on the Lock Screen and Dynamic Island when the app is backgrounded
- Requires an Activity Attributes definition and a Widget Extension in the native iOS project

### Apple Health Export (Phase 4)

- Package: `react-native-health`
- Export completed sessions only (not live streaming)
- Requires HealthKit entitlement and `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` in `Info.plist`

### WatchOS Companion (Phase 3)

- Native SwiftUI app using HealthKit workout sessions
- Real-time HR streaming via WatchConnectivity framework
- Requires a Watch target in the Xcode project and shared App Group for data passing

## Known Issues

- `ios/` is managed by Expo prebuild — avoid manual edits unless necessary
- `app.json` holds iOS-specific settings (bundleId, entitlements)
- When background recording lands (Phase 3), the app will need `bluetooth-central` and `processing` background modes. BLE connections survive suspension but callbacks may be delayed.
