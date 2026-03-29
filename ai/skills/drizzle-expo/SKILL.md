---
name: drizzle-expo
description: Use this skill for official Drizzle ORM workflow in Expo apps: schema changes, drizzle-kit migration generation, bundled SQL migrations, and Drizzle migrator startup wiring.
---
# Drizzle Expo

Use this skill when the task changes SQLite schema, updates generated migrations, or needs the official Drizzle workflow for Expo.

## Use It Alongside

- `ai/skills/sqlite-persistence/SKILL.md` for this app's session-recording rules, storage boundaries, and repository contracts.
- `ai/skills/architecture/SKILL.md` for layer ownership and direction.

## Official Workflow

1. Update `src/services/db/schema.ts`.
2. Ensure `drizzle.config.ts` points to the schema with `dialect: 'sqlite'` and `driver: 'expo'`.
3. Generate migrations with `npm run db:generate` or `npx drizzle-kit generate`.
4. Commit the generated `drizzle/` artifacts:
   - SQL files
   - `drizzle/migrations.js`
   - `drizzle/meta/*`
5. Apply migrations at app startup with Drizzle's Expo migrator from `drizzle-orm/expo-sqlite/migrator`.

## Required Project Wiring

- `babel.config.js` must include `inline-import` for `.sql`.
- `metro.config.js` must add `sql` to `resolver.sourceExts`.
- `src/services/db/migrations.ts` should import `drizzle/migrations` and call Drizzle's migrator.

## Commands

- Generate migrations: `npm run db:generate`
- Check migration graph: `npm run db:check`
- Use raw `npx drizzle-kit ...` commands only when you intentionally need the direct official CLI.

## Repo Rules

- Treat `src/services/db/schema.ts` as the schema source of truth.
- Do not hand-edit generated files under `drizzle/`.
- Keep repositories in `src/services/db/` domain-oriented. Hooks and screens should call repository methods, not generated migration assets.
- Favor Drizzle-managed migrations over custom `PRAGMA user_version` flows unless a documented Expo limitation forces an exception.

## Testing Guidance

- Mock `drizzle-orm/expo-sqlite/migrator` in Jest when testing startup initialization logic.
- Map `.sql` imports in Jest so generated migration bundles can be imported safely in tests.
- Keep migration tests focused on init idempotency and startup wiring, not SQL parser behavior.

## Common Mistakes

- Editing the schema without regenerating `drizzle/`.
- Forgetting the Babel or Metro `.sql` wiring.
- Calling repository writes before startup migration initialization completes.
- Replacing domain repositories with table-level writes in UI or feature hooks.
