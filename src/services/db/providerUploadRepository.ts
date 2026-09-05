import type { SQLiteDatabase } from 'expo-sqlite';

import { getSQLiteDatabase } from './database';
import type {
  CreateProviderUploadInput,
  PersistedProviderUpload,
  SessionUploadState,
  UpdateProviderUploadStateInput,
} from '../../types/sessionPersistence';

interface PersistedProviderUploadRow {
  id: string;
  sessionId: string;
  providerId: string;
  uploadState: SessionUploadState;
  externalId: string | null;
  errorMessage: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

function mapRow(row: PersistedProviderUploadRow): PersistedProviderUpload {
  return {
    id: row.id,
    sessionId: row.sessionId,
    providerId: row.providerId,
    uploadState: row.uploadState,
    externalId: row.externalId,
    errorMessage: row.errorMessage,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  };
}

const SELECT_COLUMNS = `
  id,
  session_id AS sessionId,
  provider_id AS providerId,
  upload_state AS uploadState,
  external_id AS externalId,
  error_message AS errorMessage,
  created_at_ms AS createdAtMs,
  updated_at_ms AS updatedAtMs
`;

const RANDOM_RADIX = 36;
const RANDOM_ID_LENGTH = 8;
const UPLOAD_ID_PREFIX = 'upload';

function getProviderUploadRow(
  database: SQLiteDatabase,
  sessionId: string,
  providerId: string,
): PersistedProviderUploadRow | null {
  return database.getFirstSync<PersistedProviderUploadRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM session_provider_uploads
     WHERE session_id = ? AND provider_id = ?`,
    sessionId,
    providerId,
  );
}

function createUploadId(nowMs: number): string {
  const randomPart = Math.random()
    .toString(RANDOM_RADIX)
    .slice(2, 2 + RANDOM_ID_LENGTH);
  return `${UPLOAD_ID_PREFIX}-${nowMs}-${randomPart}`;
}

export function createProviderUpload(input: CreateProviderUploadInput): PersistedProviderUpload {
  const database = getSQLiteDatabase();
  const now = Date.now();
  const id = createUploadId(now);
  const initialState: SessionUploadState = 'ready';

  database.runSync(
    `INSERT INTO session_provider_uploads (
      id, session_id, provider_id, upload_state,
      external_id, error_message, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.sessionId,
    input.providerId,
    initialState,
    null,
    null,
    now,
    now,
  );

  return {
    id,
    sessionId: input.sessionId,
    providerId: input.providerId,
    uploadState: initialState,
    externalId: null,
    errorMessage: null,
    createdAtMs: now,
    updatedAtMs: now,
  };
}

export function getOrCreateProviderUpload(input: CreateProviderUploadInput): PersistedProviderUpload {
  const database = getSQLiteDatabase();
  const now = Date.now();
  const id = createUploadId(now);
  const initialState: SessionUploadState = 'ready';

  database.runSync(
    `INSERT OR IGNORE INTO session_provider_uploads (
      id, session_id, provider_id, upload_state,
      external_id, error_message, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.sessionId,
    input.providerId,
    initialState,
    null,
    null,
    now,
    now,
  );

  const row = getProviderUploadRow(database, input.sessionId, input.providerId);
  if (!row) {
    throw new Error(
      `[providerUploadRepository] Failed to load provider upload for session "${input.sessionId}" and provider "${input.providerId}".`,
    );
  }

  return mapRow(row);
}

/**
 * Moves a row to `nextState`, but only from one of `allowedStates`, so the whole
 * transition is one atomic step and a caller that loses the race gets `null`
 * instead of trampling the winner. `clearOutcome` wipes the recorded remote id
 * and error text; transitions that only reclassify an existing attempt keep them.
 */
function transitionProviderUpload(
  input: CreateProviderUploadInput,
  allowedStates: readonly SessionUploadState[],
  nextState: SessionUploadState,
  clearOutcome: boolean,
): PersistedProviderUpload | null {
  const database = getSQLiteDatabase();
  const now = Date.now();
  const statePlaceholders = allowedStates.map(() => '?').join(', ');

  const result = clearOutcome
    ? database.runSync(
        `UPDATE session_provider_uploads
     SET upload_state = ?,
         external_id = ?,
         error_message = ?,
         updated_at_ms = ?
     WHERE session_id = ? AND provider_id = ? AND upload_state IN (${statePlaceholders})`,
        nextState,
        null,
        null,
        now,
        input.sessionId,
        input.providerId,
        ...allowedStates,
      )
    : database.runSync(
        `UPDATE session_provider_uploads
     SET upload_state = ?,
         updated_at_ms = ?
     WHERE session_id = ? AND provider_id = ? AND upload_state IN (${statePlaceholders})`,
        nextState,
        now,
        input.sessionId,
        input.providerId,
        ...allowedStates,
      );

  if (result.changes === 0) {
    return null;
  }

  const row = getProviderUploadRow(database, input.sessionId, input.providerId);
  if (!row) {
    throw new Error(
      `[providerUploadRepository] Failed to load provider upload after moving it to "${nextState}" for session "${input.sessionId}" and provider "${input.providerId}".`,
    );
  }

  return mapRow(row);
}

export function claimProviderUpload(input: CreateProviderUploadInput): PersistedProviderUpload | null {
  return transitionProviderUpload(input, ['ready', 'failed'], 'uploading', true);
}

/**
 * Claims an attempt the user has decided to send again after an interruption.
 * Kept separate from {@link claimProviderUpload} so an ordinary retry can never
 * resend an attempt whose remote outcome is still unknown.
 */
export function claimInterruptedProviderUpload(input: CreateProviderUploadInput): PersistedProviderUpload | null {
  return transitionProviderUpload(input, ['interrupted'], 'uploading', true);
}

/**
 * Reclassifies a single abandoned `uploading` row as `interrupted`. The recorded
 * remote id survives, because it is the only handle on what the provider may
 * already have.
 */
export function markProviderUploadInterrupted(input: CreateProviderUploadInput): PersistedProviderUpload | null {
  return transitionProviderUpload(input, ['uploading'], 'interrupted', false);
}

/**
 * Records the user's answer that the provider already has this ride, so the app
 * stops offering to send it again.
 */
export function markInterruptedProviderUploadAcknowledged(
  input: CreateProviderUploadInput,
): PersistedProviderUpload | null {
  return transitionProviderUpload(input, ['interrupted'], 'uploaded', true);
}

/**
 * Boot-time sweep: no upload can be live before the app has started one, so every
 * row still marked `uploading` belongs to a process that was killed mid-attempt.
 * Returns how many rows were reclassified.
 */
export function markAbandonedProviderUploadsInterrupted(): number {
  const database = getSQLiteDatabase();
  const abandonedState: SessionUploadState = 'uploading';
  const nextState: SessionUploadState = 'interrupted';
  const result = database.runSync(
    `UPDATE session_provider_uploads
     SET upload_state = ?,
         updated_at_ms = ?
     WHERE upload_state = ?`,
    nextState,
    Date.now(),
    abandonedState,
  );

  return result.changes;
}

export function getProviderUpload(sessionId: string, providerId: string): PersistedProviderUpload | null {
  const database = getSQLiteDatabase();
  const row = getProviderUploadRow(database, sessionId, providerId);

  return row ? mapRow(row) : null;
}

export function getProviderUploadsBySessionId(sessionId: string): PersistedProviderUpload[] {
  const database = getSQLiteDatabase();
  const rows = database.getAllSync<PersistedProviderUploadRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM session_provider_uploads
     WHERE session_id = ?
     ORDER BY created_at_ms ASC`,
    sessionId,
  );

  return rows.map(mapRow);
}

export function updateProviderUploadState(input: UpdateProviderUploadStateInput): void {
  const database = getSQLiteDatabase();
  database.runSync(
    `UPDATE session_provider_uploads
     SET upload_state = ?,
         external_id = ?,
         error_message = ?,
         updated_at_ms = ?
     WHERE session_id = ? AND provider_id = ?`,
    input.uploadState,
    input.externalId,
    input.errorMessage,
    Date.now(),
    input.sessionId,
    input.providerId,
  );
}

export function deleteProviderUploadsBySessionId(sessionId: string): void {
  const database = getSQLiteDatabase();
  database.runSync('DELETE FROM session_provider_uploads WHERE session_id = ?', sessionId);
}
