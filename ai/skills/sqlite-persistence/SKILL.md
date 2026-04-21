---
name: sqlite-persistence
description: Use when working on Expo SQLite, repository persistence, session-recording rules, or recorded workout storage decisions in this repo.
---
# SQLite Persistence

For the official Drizzle migration and generation workflow, also use `ai/skills/drizzle-expo/SKILL.md`.

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

- Schema, generation, and migrator wiring are owned by `ai/skills/drizzle-expo/SKILL.md`.
- App-policy rule: treat custom `PRAGMA user_version` migrations as an exception path, not the default.

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

## Community Sources

- **Expo SQLite API** — current `expo-sqlite` and `expo-sqlite/kv-store` APIs, transactions, and platform notes via `context7` (library: `expo-sqlite`).
