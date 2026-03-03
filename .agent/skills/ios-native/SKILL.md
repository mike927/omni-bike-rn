---
name: ios-native
description: Use this skill when implementing iOS Live Activities, the Dynamic Island, or Apple HealthKit.
---
## Live Activities
* Use `@kingstinct/react-native-activity-kit` for iOS Live Activities.
* The Dynamic Island MUST display elapsed time, HR, and Power when a session is active and the app is backgrounded.

## Background Modes
* App requires `UIBackgroundModes` (`bluetooth-central`) in `Info.plist` to prevent suspension.
