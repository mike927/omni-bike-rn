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

export function claimProviderUpload(input: CreateProviderUploadInput): PersistedProviderUpload | null {
  const database = getSQLiteDatabase();
  const now = Date.now();
  const nextState: SessionUploadState = 'uploading';
  const result = database.runSync(
    `UPDATE session_provider_uploads
     SET upload_state = ?,
         external_id = ?,
         error_message = ?,
         updated_at_ms = ?
     WHERE session_id = ? AND provider_id = ? AND upload_state IN (?, ?)`,
    nextState,
    null,
    null,
    now,
    input.sessionId,
    input.providerId,
    'ready',
    'failed',
  );

  if (result.changes === 0) {
    return null;
  }

  const row = getProviderUploadRow(database, input.sessionId, input.providerId);
  if (!row) {
    throw new Error(
      `[providerUploadRepository] Failed to claim provider upload for session "${input.sessionId}" and provider "${input.providerId}".`,
    );
  }

  return mapRow(row);
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
