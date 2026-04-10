import {
  claimProviderUpload,
  createProviderUpload,
  deleteProviderUploadsBySessionId,
  getProviderUpload,
  getOrCreateProviderUpload,
  getProviderUploadsBySessionId,
  updateProviderUploadState,
} from '../providerUploadRepository';
import { getSQLiteDatabase } from '../database';

jest.mock('../database', () => ({
  getSQLiteDatabase: jest.fn(),
}));

describe('providerUploadRepository', () => {
  const mockGetSQLiteDatabase = getSQLiteDatabase as jest.MockedFunction<typeof getSQLiteDatabase>;

  const buildDatabase = () => {
    const database = {
      getAllSync: jest.fn(),
      getFirstSync: jest.fn(),
      runSync: jest.fn().mockReturnValue({ changes: 1, lastInsertRowId: 0 }),
    };

    mockGetSQLiteDatabase.mockReturnValue(database as never);
    return database;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a provider upload record with ready state', () => {
    const database = buildDatabase();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5000);

    const result = createProviderUpload({ sessionId: 'session-1', providerId: 'strava' });

    expect(database.runSync.mock.calls[0]?.[0]).toContain('INSERT INTO session_provider_uploads');
    expect(result.sessionId).toBe('session-1');
    expect(result.providerId).toBe('strava');
    expect(result.uploadState).toBe('ready');
    expect(result.externalId).toBeNull();
    expect(result.errorMessage).toBeNull();
    expect(result.createdAtMs).toBe(5000);
    expect(result.id).toMatch(/^upload-5000-/);

    nowSpy.mockRestore();
  });

  it('returns a provider upload by session and provider', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue({
      id: 'upload-1',
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'ready',
      externalId: null,
      errorMessage: null,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });

    const result = getProviderUpload('session-1', 'strava');

    expect(result).toEqual({
      id: 'upload-1',
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'ready',
      externalId: null,
      errorMessage: null,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });
    expect(database.getFirstSync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE session_id = ? AND provider_id = ?'),
      'session-1',
      'strava',
    );
  });

  it('returns the existing provider upload when insert-or-ignore hits a duplicate', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue({
      id: 'upload-existing',
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'ready',
      externalId: null,
      errorMessage: null,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });

    const result = getOrCreateProviderUpload({ sessionId: 'session-1', providerId: 'strava' });

    expect(database.runSync.mock.calls[0]?.[0]).toContain('INSERT OR IGNORE INTO session_provider_uploads');
    expect(result).toEqual({
      id: 'upload-existing',
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'ready',
      externalId: null,
      errorMessage: null,
      createdAtMs: 1000,
      updatedAtMs: 1000,
    });
  });

  it('returns null when no upload record exists', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue(null);

    expect(getProviderUpload('session-1', 'strava')).toBeNull();
  });

  it('claims a ready upload atomically before export starts', () => {
    const database = buildDatabase();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(2500);
    database.getFirstSync.mockReturnValue({
      id: 'upload-existing',
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'uploading',
      externalId: null,
      errorMessage: null,
      createdAtMs: 1000,
      updatedAtMs: 2500,
    });

    const result = claimProviderUpload({ sessionId: 'session-1', providerId: 'strava' });

    expect(database.runSync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE session_id = ? AND provider_id = ? AND upload_state IN (?, ?)'),
      'uploading',
      null,
      null,
      2500,
      'session-1',
      'strava',
      'ready',
      'failed',
    );
    expect(result?.uploadState).toBe('uploading');

    nowSpy.mockRestore();
  });

  it('returns null when an upload claim loses the race', () => {
    const database = buildDatabase();
    database.runSync.mockReturnValue({ changes: 0, lastInsertRowId: 0 });

    expect(claimProviderUpload({ sessionId: 'session-1', providerId: 'strava' })).toBeNull();
    expect(database.getFirstSync).not.toHaveBeenCalled();
  });

  it('returns all uploads for a session ordered by creation time', () => {
    const database = buildDatabase();
    database.getAllSync.mockReturnValue([
      {
        id: 'upload-1',
        sessionId: 'session-1',
        providerId: 'strava',
        uploadState: 'uploaded',
        externalId: 'ext-1',
        errorMessage: null,
        createdAtMs: 1000,
        updatedAtMs: 2000,
      },
    ]);

    const result = getProviderUploadsBySessionId('session-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.providerId).toBe('strava');
    expect(database.getAllSync.mock.calls[0]?.[0]).toContain('ORDER BY created_at_ms ASC');
  });

  it('updates upload state with external id and error message', () => {
    const database = buildDatabase();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(3000);

    updateProviderUploadState({
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'uploaded',
      externalId: 'ext-123',
      errorMessage: null,
    });

    expect(database.runSync.mock.calls[0]?.[0]).toContain('UPDATE session_provider_uploads');
    expect(database.runSync).toHaveBeenCalledWith(
      expect.any(String),
      'uploaded',
      'ext-123',
      null,
      3000,
      'session-1',
      'strava',
    );

    nowSpy.mockRestore();
  });

  it('updates upload state with error message on failure', () => {
    const database = buildDatabase();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(4000);

    updateProviderUploadState({
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'failed',
      externalId: null,
      errorMessage: 'Network timeout',
    });

    expect(database.runSync).toHaveBeenCalledWith(
      expect.any(String),
      'failed',
      null,
      'Network timeout',
      4000,
      'session-1',
      'strava',
    );

    nowSpy.mockRestore();
  });

  it('clears stale failure details when an upload later succeeds', () => {
    const database = buildDatabase();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(4500);

    updateProviderUploadState({
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'uploaded',
      externalId: 'ext-999',
      errorMessage: null,
    });

    expect(database.runSync).toHaveBeenCalledWith(
      expect.any(String),
      'uploaded',
      'ext-999',
      null,
      4500,
      'session-1',
      'strava',
    );

    nowSpy.mockRestore();
  });

  it('deletes all uploads for a session', () => {
    const database = buildDatabase();

    deleteProviderUploadsBySessionId('session-1');

    expect(database.runSync).toHaveBeenCalledWith(
      'DELETE FROM session_provider_uploads WHERE session_id = ?',
      'session-1',
    );
  });
});
