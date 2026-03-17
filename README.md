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
npm run lint
npm run typecheck
npm test -- --ci --runInBand
npm run ci:gate
npm run build:smoke
```

## Development Standards

- Branches: `feature/*`, `bugfix/*`, `hotfix/*`
- Commits: Conventional Commits, for example `feat: add BLE metronome engine`
- Agent instructions: `AGENTS.md`
- Main AI setup: `ai/*`
- App code remains outside the AI workspace
