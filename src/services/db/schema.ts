import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { PersistedSessionStatus, SessionUploadState } from '../../types/sessionPersistence';

export const trainingSessionsTable = sqliteTable(
  'training_sessions',
  {
    id: text('id').primaryKey(),
    status: text('status').$type<PersistedSessionStatus>().notNull(),
    startedAtMs: integer('started_at_ms').notNull(),
    endedAtMs: integer('ended_at_ms'),
    elapsedSeconds: integer('elapsed_seconds').notNull(),
    totalDistanceMeters: real('total_distance_meters').notNull(),
    totalCaloriesKcal: real('total_calories_kcal').notNull(),
    currentSpeedKmh: real('current_speed_kmh').notNull(),
    currentCadenceRpm: integer('current_cadence_rpm').notNull(),
    currentPowerWatts: integer('current_power_watts').notNull(),
    currentHeartRateBpm: integer('current_heart_rate_bpm'),
    currentResistanceLevel: integer('current_resistance_level'),
    currentDistanceMeters: real('current_distance_meters'),
    savedBikeId: text('saved_bike_id'),
    savedBikeName: text('saved_bike_name'),
    savedHrId: text('saved_hr_id'),
    savedHrName: text('saved_hr_name'),
    uploadState: text('upload_state').$type<SessionUploadState | null>(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    index('training_sessions_status_updated_at_idx').on(table.status, table.updatedAtMs),
    index('training_sessions_started_at_idx').on(table.startedAtMs),
  ],
);

export const trainingSessionSamplesTable = sqliteTable(
  'training_session_samples',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    sequence: integer('sequence').notNull(),
    recordedAtMs: integer('recorded_at_ms').notNull(),
    elapsedSeconds: integer('elapsed_seconds').notNull(),
    speedKmh: real('speed_kmh').notNull(),
    cadenceRpm: integer('cadence_rpm').notNull(),
    powerWatts: integer('power_watts').notNull(),
    heartRateBpm: integer('heart_rate_bpm'),
    resistanceLevel: integer('resistance_level'),
    distanceMeters: real('distance_meters'),
  },
  (table) => [
    index('training_session_samples_session_recorded_at_idx').on(table.sessionId, table.recordedAtMs),
    uniqueIndex('training_session_samples_session_sequence_idx').on(table.sessionId, table.sequence),
  ],
);
