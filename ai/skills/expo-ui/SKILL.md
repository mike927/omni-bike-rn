---
name: expo-ui
description: Use when building or refining Expo Router screens, navigation, styling, and interaction patterns in this repo.
---

# Expo UI

## Core Repo Rules

- Keep route files under `app/`; keep shared components, types, and utilities under `src/`.
- Remove obsolete route files when restructuring navigation.
- Prefer Expo Router primitives such as `<Link />` and stack `_layout.tsx` files.
- Account for safe areas with stack headers or scroll/list containers using `contentInsetAdjustmentBehavior="automatic"`.
- Prefer React Native primitives over web markup, and prefer `expo-image` for app images.
- Use inline styles unless extracting a shared `StyleSheet` is clearly cleaner.
- Preserve the existing product language unless the task is an explicit redesign.

## Read Next When Needed

- Detailed routing, styling, and library guidance: [references/expo-ui-reference.md](references/expo-ui-reference.md)
