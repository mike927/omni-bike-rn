---
name: ios-native
description: Use when working on iOS-specific behavior, Apple platform integrations, background modes, or native project setup in this repo.
---
# iOS Native

## Current Constraints

- **Expo SDK 54** with New Architecture (JSI) enforced
- **expo-router** for file-based navigation
- iOS is the **primary and only target** for the MVP
- For `ios/` committing and Watch target rules, see `ai/skills/project-context/SKILL.md` § `Native iOS Constraints`

## Key Integrations

- `react-native-activity-kit` for Live Activities and Dynamic Island surfaces
- `react-native-health` for completed-session Apple Health export
- SwiftUI Watch app plus HealthKit and WatchConnectivity for watch-based HR integration

## Platform Notes

- Prefer Expo config and incremental prebuild for managed changes; manual Xcode edits are for native-only surfaces.
- `app.json` holds iOS-specific settings such as bundle ID and entitlements.
- Background BLE/watch work may need `bluetooth-central` and `processing` modes; suspension can delay callbacks even when connections survive.
