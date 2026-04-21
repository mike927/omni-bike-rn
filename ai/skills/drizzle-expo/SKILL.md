---
name: drizzle-expo
description: Use when changing SQLite schema, generating Drizzle migrations, or wiring the official Drizzle Expo migrator flow.
---
# Drizzle Expo

## Use It Alongside

- `ai/skills/sqlite-persistence/SKILL.md` for this app's session-recording rules, storage boundaries, and repository contracts.
- `ai/skills/architecture/SKILL.md` for layer ownership and direction.

## Workflow Shape

- `src/services/db/schema.ts` is the schema source of truth.
- `drizzle.config.ts` points to the schema with `dialect: 'sqlite'` and `driver: 'expo'`.
- `npm run db:generate` (or `npx drizzle-kit generate`) emits SQL + bookkeeping under `drizzle/`.
- The generated artifacts (`drizzle/*.sql`, `drizzle/migrations.js`, `drizzle/meta/*`) are committed — they are the deployable migration bundle.
- Drizzle's Expo migrator (`drizzle-orm/expo-sqlite/migrator`) applies the bundle at app startup.

## Required Project Wiring

- `babel.config.js` must include `inline-import` for `.sql`.
- `metro.config.js` must add `sql` to `resolver.sourceExts`.
- `src/services/db/migrations.ts` should import `drizzle/migrations` and call Drizzle's migrator.

## Commands

- Generate migrations: `npm run db:generate`
- Check migration graph: `npm run db:check`
- Use raw `npx drizzle-kit ...` commands only when you intentionally need the direct official CLI.

## Repo Rules

- Do not hand-edit generated files under `drizzle/`.
- Repository contracts and the PRAGMA-exception policy are owned by `ai/skills/sqlite-persistence/SKILL.md`.

## Testing Notes

- Mock `drizzle-orm/expo-sqlite/migrator` in Jest when testing startup initialization logic.
- Keep migration tests focused on init idempotency and wiring, not SQL parser behavior.
