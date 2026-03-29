import { getSQLiteDatabase } from './database';
import type {
  AppendSampleInput,
  CreateDraftSessionInput,
  FinalizeSessionInput,
  PersistedDeviceSnapshot,
  PersistedTrainingSession,
  PersistedTrainingSessionRow,
  SessionUploadState,
  UpdateSessionStatusInput,
} from '../../types/sessionPersistence';

const COMPLETED_UPLOAD_STATE: SessionUploadState = 'ready';

function toDeviceSnapshot(id: string | null, name: string | null): PersistedDeviceSnapshot | null {
  if (!id || !name) {
    return null;
  }

  return { id, name };
}

function mapSessionRow(row: PersistedTrainingSessionRow): PersistedTrainingSession {
  return {
    id: row.id,
    status: row.status,
    startedAtMs: row.startedAtMs,
    endedAtMs: row.endedAtMs,
    elapsedSeconds: row.elapsedSeconds,
    totalDistanceMeters: row.totalDistanceMeters,
    totalCaloriesKcal: row.totalCaloriesKcal,
    currentMetrics: {
      speed: row.currentSpeedKmh,
      cadence: row.currentCadenceRpm,
      power: row.currentPowerWatts,
      heartRate: row.currentHeartRateBpm,
      resistance: row.currentResistanceLevel,
      distance: row.currentDistanceMeters,
    },
    savedBikeSnapshot: toDeviceSnapshot(row.savedBikeId, row.savedBikeName),
    savedHrSnapshot: toDeviceSnapshot(row.savedHrId, row.savedHrName),
    uploadState: row.uploadState,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  };
}

export function createDraftSession(input: CreateDraftSessionInput): string {
  const database = getSQLiteDatabase();
  database.runSync(
    `INSERT INTO training_sessions (
      id,
      status,
      started_at_ms,
      ended_at_ms,
      elapsed_seconds,
      total_distance_meters,
      total_calories_kcal,
      current_speed_kmh,
      current_cadence_rpm,
      current_power_watts,
      current_heart_rate_bpm,
      current_resistance_level,
      current_distance_meters,
      saved_bike_id,
      saved_bike_name,
      saved_hr_id,
      saved_hr_name,
      upload_state,
      created_at_ms,
      updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.sessionId,
    'active',
    input.startedAtMs,
    null,
    input.elapsedSeconds,
    input.totalDistanceMeters,
    input.totalCaloriesKcal,
    input.currentMetrics.speed,
    input.currentMetrics.cadence,
    input.currentMetrics.power,
    input.currentMetrics.heartRate,
    input.currentMetrics.resistance,
    input.currentMetrics.distance,
    input.savedBikeSnapshot?.id ?? null,
    input.savedBikeSnapshot?.name ?? null,
    input.savedHrSnapshot?.id ?? null,
    input.savedHrSnapshot?.name ?? null,
    null,
    input.startedAtMs,
    input.startedAtMs,
  );

  return input.sessionId;
}

export function appendSample(input: AppendSampleInput): void {
  const database = getSQLiteDatabase();
  database.withTransactionSync(() => {
    database.runSync(
      `INSERT INTO training_session_samples (
        id,
        session_id,
        sequence,
        recorded_at_ms,
        elapsed_seconds,
        speed_kmh,
        cadence_rpm,
        power_watts,
        heart_rate_bpm,
        resistance_level,
        distance_meters
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.sampleId,
      input.sessionId,
      input.sequence,
      input.recordedAtMs,
      input.elapsedSeconds,
      input.currentMetrics.speed,
      input.currentMetrics.cadence,
      input.currentMetrics.power,
      input.currentMetrics.heartRate,
      input.currentMetrics.resistance,
      input.currentMetrics.distance,
    );

    database.runSync(
      `UPDATE training_sessions
       SET status = ?,
           elapsed_seconds = ?,
           total_distance_meters = ?,
           total_calories_kcal = ?,
           current_speed_kmh = ?,
           current_cadence_rpm = ?,
           current_power_watts = ?,
           current_heart_rate_bpm = ?,
           current_resistance_level = ?,
           current_distance_meters = ?,
           updated_at_ms = ?
       WHERE id = ?`,
      'active',
      input.elapsedSeconds,
      input.totalDistanceMeters,
      input.totalCaloriesKcal,
      input.currentMetrics.speed,
      input.currentMetrics.cadence,
      input.currentMetrics.power,
      input.currentMetrics.heartRate,
      input.currentMetrics.resistance,
      input.currentMetrics.distance,
      input.recordedAtMs,
      input.sessionId,
    );
  });
}

export function updateSessionStatus(input: UpdateSessionStatusInput): void {
  const database = getSQLiteDatabase();
  database.runSync(
    'UPDATE training_sessions SET status = ?, updated_at_ms = ? WHERE id = ?',
    input.status,
    input.updatedAtMs,
    input.sessionId,
  );
}

export function finalizeSession(input: FinalizeSessionInput): void {
  const database = getSQLiteDatabase();
  database.runSync(
    `UPDATE training_sessions
     SET status = ?,
         ended_at_ms = ?,
         elapsed_seconds = ?,
         total_distance_meters = ?,
         total_calories_kcal = ?,
         current_speed_kmh = ?,
         current_cadence_rpm = ?,
         current_power_watts = ?,
         current_heart_rate_bpm = ?,
         current_resistance_level = ?,
         current_distance_meters = ?,
         upload_state = ?,
         updated_at_ms = ?
     WHERE id = ?`,
    'finished',
    input.endedAtMs,
    input.elapsedSeconds,
    input.totalDistanceMeters,
    input.totalCaloriesKcal,
    input.currentMetrics.speed,
    input.currentMetrics.cadence,
    input.currentMetrics.power,
    input.currentMetrics.heartRate,
    input.currentMetrics.resistance,
    input.currentMetrics.distance,
    COMPLETED_UPLOAD_STATE,
    input.updatedAtMs,
    input.sessionId,
  );
}

export function discardDraftSession(sessionId: string): void {
  const database = getSQLiteDatabase();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM training_session_samples WHERE session_id = ?', sessionId);
    database.runSync('DELETE FROM training_sessions WHERE id = ?', sessionId);
  });
}

export function getLatestOpenSession(): PersistedTrainingSession | null {
  const database = getSQLiteDatabase();
  const row = database.getFirstSync<PersistedTrainingSessionRow>(
    `SELECT
       id,
       status,
       started_at_ms AS startedAtMs,
       ended_at_ms AS endedAtMs,
       elapsed_seconds AS elapsedSeconds,
       total_distance_meters AS totalDistanceMeters,
       total_calories_kcal AS totalCaloriesKcal,
       current_speed_kmh AS currentSpeedKmh,
       current_cadence_rpm AS currentCadenceRpm,
       current_power_watts AS currentPowerWatts,
       current_heart_rate_bpm AS currentHeartRateBpm,
       current_resistance_level AS currentResistanceLevel,
       current_distance_meters AS currentDistanceMeters,
       saved_bike_id AS savedBikeId,
       saved_bike_name AS savedBikeName,
       saved_hr_id AS savedHrId,
       saved_hr_name AS savedHrName,
       upload_state AS uploadState,
       created_at_ms AS createdAtMs,
       updated_at_ms AS updatedAtMs
     FROM training_sessions
     WHERE status IN (?, ?)
     ORDER BY updated_at_ms DESC
     LIMIT 1`,
    'active',
    'paused',
  );

  return row ? mapSessionRow(row) : null;
}
