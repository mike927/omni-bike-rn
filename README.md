# Omni Bike RN

Indoor cycling companion app built with Expo Router and React Native.

## Start Here

- AI setup overview lives in [`ai/docs/overview.md`](ai/docs/overview.md).
- Project progress and current status live in [`plan.md`](plan.md).
- Agent instructions and workflow rules live in [`AGENTS.md`](AGENTS.md).
- AI setup elements and file roles live in [`ai/docs/elements.md`](ai/docs/elements.md).

## Core Commands

```bash
npm run start
npm run ios -- --device
npm run lint
npm run typecheck
npm test -- --ci --runInBand
npm run ci:gate
npm run build:smoke
```

## iPhone Development Workflow

This app uses native modules such as `react-native-ble-plx` and includes `expo-dev-client`, so a physical iPhone needs a local development build installed. `npm run start` only starts Metro. It does not install the app on your phone.

### When To Run Which Command

`npm run ios -- --device`

- Run this the first time you want the app on your iPhone.
- Run this again if you deleted the app from the phone.
- Run this again after changing native dependencies, Expo plugins, or other iOS native config (for example: adding `react-native-health`, changing BLE permissions, editing `app.json`, or adding an Expo plugin).
- Run this again after upgrading Expo or React Native (for example: changing the Expo SDK version or React Native version in `package.json`).
- Run this again if the QR code says the app is no longer available (for example: the dev build was removed from the phone, became outdated, or no longer matches the current project setup).

`npm run start`

- Run this when the development build is already installed on the iPhone.
- Use this for normal day-to-day JavaScript and UI changes.
- Keep it running while you open the installed app on the phone.

### Usual Daily Flow

1. Install or reinstall the iPhone development build when needed:

   ```bash
   npm run ios -- --device
   ```

2. Start Metro:

   ```bash
   npm run start
   ```

3. Open the already installed app on your iPhone.

### After A Code Change

- For JavaScript, TypeScript, routing, hooks, state, and styling changes: keep using `npm run start`.
- For `app.json`, native package, permission, plugin, or iOS project changes: rerun `npm run ios -- --device`, then `npm run start`.

### Quick Rule Of Thumb

If the phone already has the Omni Bike development app installed, start with `npm run start`.

If the phone cannot open the project, says the app is unavailable, or native setup changed, run `npm run ios -- --device`.

## Development Standards

- Branches: `feature/*`, `bugfix/*`, `hotfix/*`
- Commits: Conventional Commits, for example `feat: add BLE metronome engine`
- Agent instructions: `AGENTS.md`
- Main AI setup: `ai/*`
- App code remains outside the AI workspace
