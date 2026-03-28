# Manual Testing Checklist

## Goal

Confirm that the local Expo config plugin reduces Xcode warning noise without breaking iOS prebuild or the app's normal build flow.

## Setup

1. From `/private/tmp/omni-bike-rn-xcode-warning-cleanup-main`, run `npx expo prebuild --clean --platform ios`.
2. Change into `ios/` and run `pod install --repo-update`.
3. Open `omnibikern.xcworkspace` in Xcode.
4. Select your normal simulator or test device and set your signing team if Xcode asks for it.

## Checks

1. Run `Product > Clean Build Folder`.
2. Build the app in Xcode.
3. Confirm the build succeeds.
4. Confirm the warning count stays dramatically lower than the original 1000+ warning baseline.
5. Spot-check the Issue Navigator and confirm the remaining warnings are mostly third-party Expo / React Native warnings, not app-source warnings from this repository.
6. Launch the app on a simulator or device and confirm it opens normally.
7. Navigate through the main app shell and confirm there is no obvious startup or routing regression after prebuild.

## Expected Outcome

- `expo prebuild` succeeds.
- `pod install` succeeds.
- Xcode builds successfully.
- Warning noise is substantially reduced.
- The app still launches and behaves normally for a basic smoke test.
