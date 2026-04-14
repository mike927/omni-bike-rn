import { getSQLiteDatabase } from './database';
import type {
  AppendSampleInput,
  CreateDraftSessionInput,
  FinalizeSessionInput,
  PersistedDeviceSnapshot,
  PersistedTrainingSession,
  PersistedTrainingSample,
  SessionUploadState,
  PersistedSessionStatus,
  UpdateSessionStatusInput,
} from '../../types/sessionPersistence';
import type { MetricSnapshot } from '../../types/training';

const COMPLETED_UPLOAD_STATE: SessionUploadState = 'ready';
export const STALE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface PersistedTrainingSessionRow {
  id: string;
  status: PersistedSessionStatus;
  startedAtMs: number;
  endedAtMs: number | null;
  elapsedSeconds: number;
  totalDistanceMeters: number;
  totalCaloriesKcal: number;
  currentSpeedKmh: number;
  currentCadenceRpm: number;
  currentPowerWatts: number;
  currentHeartRateBpm: number | null;
  currentResistanceLevel: number | null;
  currentDistanceMeters: number | null;
  savedBikeId: string | null;
  savedBikeName: string | null;
  savedHrId: string | null;
  savedHrName: string | null;
  uploadState: SessionUploadState | null;
  createdAtMs: number;
  updatedAtMs: number;
}

interface PersistedTrainingSampleRow {
  id: string;
  sessionId: string;
  sequence: number;
  recordedAtMs: number;
  elapsedSeconds: number;
  speedKmh: number;
  cadenceRpm: number;
  powerWatts: number;
  heartRateBpm: number | null;
  resistanceLevel: number | null;
  distanceMeters: number | null;
}

interface LastSampleSequenceRow {
  maxSequence: number | null;
}

function mapSampleRow(row: PersistedTrainingSampleRow): PersistedTrainingSample {
  return {
    id: row.id,
    sessionId: row.sessionId,
    sequence: row.sequence,
    recordedAtMs: row.recordedAtMs,
    elapsedSeconds: row.elapsedSeconds,
    metrics: {
      speed: row.speedKmh,
      cadence: row.cadenceRpm,
      power: row.powerWatts,
      heartRate: row.heartRateBpm,
      resistance: row.resistanceLevel,
      distance: row.distanceMeters,
    } satisfies MetricSnapshot,
  };
}

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

export function createDraftSession(input: CreateDraftSessionInput): void {
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
       SET elapsed_seconds = ?,
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
    database.runSync('DELETE FROM session_provider_uploads WHERE session_id = ?', sessionId);
    database.runSync('DELETE FROM training_session_samples WHERE session_id = ?', sessionId);
    database.runSync('DELETE FROM training_sessions WHERE id = ?', sessionId);
  });
}

const SESSION_SELECT_COLUMNS = `
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
`;

export function getLatestOpenSession(): PersistedTrainingSession | null {
  const database = getSQLiteDatabase();
  const row = database.getFirstSync<PersistedTrainingSessionRow>(
    `SELECT ${SESSION_SELECT_COLUMNS}
     FROM training_sessions
     WHERE status IN (?, ?)
     ORDER BY updated_at_ms DESC
     LIMIT 1`,
    'active',
    'paused',
  );

  return row ? mapSessionRow(row) : null;
}

export function finalizeStaleOpenSessions(nowMs: number, maxAgeMs: number): PersistedTrainingSession[] {
  const database = getSQLiteDatabase();
  const staleBeforeMs = nowMs - maxAgeMs;

  const rows = database.getAllSync<PersistedTrainingSessionRow>(
    `SELECT ${SESSION_SELECT_COLUMNS}
     FROM training_sessions
     WHERE status IN (?, ?)
       AND updated_at_ms < ?
     ORDER BY updated_at_ms ASC`,
    'active',
    'paused',
    staleBeforeMs,
  );

  database.withTransactionSync(() => {
    rows.forEach((row) => {
      finalizeSession({
        sessionId: row.id,
        endedAtMs: row.updatedAtMs,
        updatedAtMs: row.updatedAtMs,
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
      });
    });
  });

  return rows
    .map((row) => getSessionById(row.id))
    .filter((session): session is PersistedTrainingSession => session !== null);
}

export function normalizeRecoveredSessionToPaused(sessionId: string): PersistedTrainingSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status === 'finished') {
    return null;
  }

  if (session.status === 'paused') {
    return session;
  }

  const database = getSQLiteDatabase();
  database.runSync(
    'UPDATE training_sessions SET status = ? WHERE id = ? AND status = ?',
    'paused',
    sessionId,
    'active',
  );

  return getSessionById(sessionId);
}

export function getSessionById(sessionId: string): PersistedTrainingSession | null {
  const database = getSQLiteDatabase();
  const row = database.getFirstSync<PersistedTrainingSessionRow>(
    `SELECT ${SESSION_SELECT_COLUMNS}
     FROM training_sessions
     WHERE id = ?`,
    sessionId,
  );

  return row ? mapSessionRow(row) : null;
}

export function getLatestFinishedSession(): PersistedTrainingSession | null {
  const database = getSQLiteDatabase();
  const row = database.getFirstSync<PersistedTrainingSessionRow>(
    `SELECT ${SESSION_SELECT_COLUMNS}
     FROM training_sessions
     WHERE status = ?
     ORDER BY ended_at_ms DESC
     LIMIT 1`,
    'finished',
  );

  return row ? mapSessionRow(row) : null;
}

export function getFinishedSessions(): PersistedTrainingSession[] {
  const database = getSQLiteDatabase();
  const rows = database.getAllSync<PersistedTrainingSessionRow>(
    `SELECT ${SESSION_SELECT_COLUMNS}
     FROM training_sessions
     WHERE status = ?
     ORDER BY ended_at_ms DESC`,
    'finished',
  );

  return rows.map(mapSessionRow);
}

export function getSamplesBySessionId(sessionId: string): PersistedTrainingSample[] {
  const database = getSQLiteDatabase();
  const rows = database.getAllSync<PersistedTrainingSampleRow>(
    `SELECT
       id,
       session_id AS sessionId,
       sequence,
       recorded_at_ms AS recordedAtMs,
       elapsed_seconds AS elapsedSeconds,
       speed_kmh AS speedKmh,
       cadence_rpm AS cadenceRpm,
       power_watts AS powerWatts,
       heart_rate_bpm AS heartRateBpm,
       resistance_level AS resistanceLevel,
       distance_meters AS distanceMeters
     FROM training_session_samples
     WHERE session_id = ?
     ORDER BY sequence ASC`,
    sessionId,
  );

  return rows.map(mapSampleRow);
}

export function getLastSampleSequence(sessionId: string): number {
  const database = getSQLiteDatabase();
  const row = database.getFirstSync<LastSampleSequenceRow>(
    `SELECT MAX(sequence) AS maxSequence
     FROM training_session_samples
     WHERE session_id = ?`,
    sessionId,
  );

  return row?.maxSequence ?? -1;
}

export function deleteSession(sessionId: string): void {
  const database = getSQLiteDatabase();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM session_provider_uploads WHERE session_id = ?', sessionId);
    database.runSync('DELETE FROM training_session_samples WHERE session_id = ?', sessionId);
    database.runSync('DELETE FROM training_sessions WHERE id = ?', sessionId);
  });
}

export function updateUploadState(sessionId: string, uploadState: SessionUploadState): void {
  const database = getSQLiteDatabase();
  database.runSync(
    'UPDATE training_sessions SET upload_state = ?, updated_at_ms = ? WHERE id = ?',
    uploadState,
    Date.now(),
    sessionId,
  );
}
