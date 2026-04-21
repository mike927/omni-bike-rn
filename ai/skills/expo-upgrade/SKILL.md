---
name: expo-upgrade
description: Use when upgrading Expo SDK versions, auditing breaking changes, or fixing dependency and native-regeneration issues in this repo.
---

# Expo SDK Upgrade

## Repo-Specific Safety

- For `ios/` commit status, Watch target, and the `expo prebuild --clean` hazard, see `ai/skills/project-context/SKILL.md` § `Native iOS Constraints`.
- Use incremental `expo prebuild` only when a native config change actually requires regeneration.

## Upgrade Loop

- Update Expo and aligned packages with `npx expo install ...` and `npx expo install --fix`.
- Run `npx expo-doctor` after dependency changes.
- If native modules or config plugins changed, prebuild incrementally and reinstall platform deps as needed.
- Clear caches last, not first, and only when symptoms suggest stale state.
- Read the target SDK changelog before applying breaking-change fixes.

## Read Next When Needed

- Detailed cache layers, deprecated packages, and audit checklist: [references/expo-upgrade-reference.md](references/expo-upgrade-reference.md)
