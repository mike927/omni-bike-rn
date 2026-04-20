---
name: sqlite-persistence
description: Use this skill for Expo SQLite, session persistence rules, repositories, and recorded workout storage decisions in this repo.
---
# SQLite Persistence

Use this skill when the task involves `expo-sqlite`, repositories under `src/services/db/`, or recorded workout persistence behavior in this app.

For the official Drizzle migration and generation workflow, also use `ai/skills/drizzle-expo/SKILL.md`.

## Source Provenance

This skill is grounded in:

- Expo SQLite docs: `https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/`
- Drizzle Expo SQLite docs: `https://orm.drizzle.team/docs/connect-expo-sqlite`
- Expo storage guidance from `expo/skills`

Use those sources as the primary reference when platform behavior is unclear.

## Repo Paths And Layer Rules

- `src/services/db/` owns database setup, migrations, schema, and repositories.
- `src/types/` owns reusable persistence interfaces and type aliases.
- `src/features/training/hooks/` may orchestrate persistence side effects, but should not contain raw SQL or schema definitions.
- Layer direction follows `AGENTS.md` § `Coding Conventions`.

## Storage Choice

- Use `expo-sqlite/kv-store` only for lightweight key-value state such as saved gear preferences.
- Use full `expo-sqlite` for relational workout data, ordered samples, and queryable session history.
- Do not move saved gear into the relational DB in this task; gear persistence remains separate by design.

## Runtime Migration Pattern

- Prefer the official Drizzle Expo flow:
  - update `src/services/db/schema.ts`
  - generate SQL with `drizzle-kit`
  - commit the generated `drizzle/` folder
  - apply the generated migration bundle through Drizzle's Expo migrator at startup
- Treat custom `PRAGMA user_version` migrations as an exception path, not the default.

## Drizzle Layout

- Define tables in `src/services/db/schema.ts`.
- Keep database open/initialization logic in `src/services/db/database.ts` and `src/services/db/migrations.ts`.
- Expose app-specific read/write methods from repository files such as `src/services/db/trainingSessionRepository.ts`.
- Prefer repository methods that speak in domain terms like `createDraftSession` or `finalizeSession` rather than leaking table details into feature code.

## Session Recording Rules

- Persist merged 1 Hz samples, not raw device-specific packets.
- Treat the app as offline-first: local writes should not depend on network availability.
- Create one draft session when training starts.
- Append one sample per active tick.
- Finalize the same session on finish — never open a second draft mid-session.
- Pause/resume updates session status without creating a second draft.
- Reset before finish deletes the unfinished draft; reset after finish preserves the completed session row.

## Testing And Mocking

- Mock `expo-sqlite` at the module boundary in Jest.
- Test migrations separately from repository behavior.
- Verify ordered sample writes, session status transitions, and discard/finalize behavior explicitly.
- Keep tests focused on repository contracts and persistence hooks rather than screen rendering.

## Common Mistakes To Avoid

- Mixing `kv-store` and relational session data in the same abstraction.
- Running repository writes before database initialization completes.
- Creating duplicate draft sessions on resume or repeated renders.
- Persisting raw BLE source state instead of the merged session snapshot.
- Hiding reusable persistence types inside hooks or repository implementation files.
