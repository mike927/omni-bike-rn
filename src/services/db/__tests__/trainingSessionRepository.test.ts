import {
  appendSample,
  createDraftSession,
  deleteSession,
  discardDraftSession,
  finalizeStaleOpenSessions,
  finalizeSession,
  getFinishedSessions,
  getLastSampleSequence,
  getLatestFinishedSession,
  getLatestOpenSession,
  getSamplesBySessionId,
  getSessionById,
  normalizeRecoveredSessionToPaused,
  updateUploadState,
  updateSessionStatus,
} from '../trainingSessionRepository';
import { getSQLiteDatabase } from '../database';

jest.mock('../database', () => ({
  getSQLiteDatabase: jest.fn(),
}));

describe('trainingSessionRepository', () => {
  const mockGetSQLiteDatabase = getSQLiteDatabase as jest.MockedFunction<typeof getSQLiteDatabase>;

  const buildDatabase = () => {
    const database = {
      getAllSync: jest.fn(),
      getFirstSync: jest.fn(),
      runSync: jest.fn(),
      withTransactionSync: jest.fn((task: () => void) => {
        task();
      }),
    };

    mockGetSQLiteDatabase.mockReturnValue(database as never);
    return database;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a draft session row', () => {
    const database = buildDatabase();

    createDraftSession({
      sessionId: 'session-1',
      startedAtMs: 100,
      elapsedSeconds: 0,
      totalDistanceMeters: 0,
      totalCaloriesKcal: 0,
      currentMetrics: {
        speed: 0,
        cadence: 0,
        power: 0,
        heartRate: null,
        resistance: null,
        distance: null,
      },
      savedBikeSnapshot: { id: 'bike-1', name: 'Bike' },
      savedHrSnapshot: { id: 'hr-1', name: 'HR' },
    });

    expect(database.runSync.mock.calls[0]?.[0]).toContain('INSERT INTO training_sessions');
  });

  it('appends a sample and updates the session in one transaction', () => {
    const database = buildDatabase();

    appendSample({
      sessionId: 'session-1',
      sampleId: 'sample-1',
      sequence: 0,
      recordedAtMs: 200,
      elapsedSeconds: 1,
      totalDistanceMeters: 10,
      totalCaloriesKcal: 1.5,
      currentMetrics: {
        speed: 36,
        cadence: 90,
        power: 220,
        heartRate: 150,
        resistance: 8,
        distance: 510,
      },
    });

    expect(database.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(database.runSync.mock.calls[0]?.[0]).toContain('INSERT INTO training_session_samples');
    expect(database.runSync.mock.calls[1]?.[0]).toContain('UPDATE training_sessions');
    expect(database.runSync.mock.calls[1]?.[0]).not.toContain('status = ?');
  });

  it('updates session status for pause and resume transitions', () => {
    const database = buildDatabase();

    updateSessionStatus({
      sessionId: 'session-1',
      status: 'paused',
      updatedAtMs: 300,
    });

    expect(database.runSync).toHaveBeenCalledWith(
      'UPDATE training_sessions SET status = ?, updated_at_ms = ? WHERE id = ?',
      'paused',
      300,
      'session-1',
    );
  });

  it('finalizes a finished session with upload state ready', () => {
    const database = buildDatabase();

    finalizeSession({
      sessionId: 'session-1',
      endedAtMs: 400,
      updatedAtMs: 400,
      elapsedSeconds: 12,
      totalDistanceMeters: 120,
      totalCaloriesKcal: 14.5,
      currentMetrics: {
        speed: 0,
        cadence: 0,
        power: 0,
        heartRate: 145,
        resistance: 6,
        distance: 620,
      },
    });

    expect(database.runSync.mock.calls[0]?.[0]).toContain('upload_state = ?');
    expect(database.runSync.mock.calls[0]).toContain('ready');
  });

  it('discards an unfinished draft and its samples and provider uploads', () => {
    const database = buildDatabase();

    discardDraftSession('session-1');

    expect(database.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(database.runSync).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM session_provider_uploads WHERE session_id = ?',
      'session-1',
    );
    expect(database.runSync).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM training_session_samples WHERE session_id = ?',
      'session-1',
    );
    expect(database.runSync).toHaveBeenNthCalledWith(3, 'DELETE FROM training_sessions WHERE id = ?', 'session-1');
  });

  it('returns the latest open session when one exists', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue({
      id: 'session-1',
      status: 'paused',
      startedAtMs: 100,
      endedAtMs: null,
      elapsedSeconds: 10,
      totalDistanceMeters: 75.5,
      totalCaloriesKcal: 11.25,
      currentSpeedKmh: 25,
      currentCadenceRpm: 80,
      currentPowerWatts: 180,
      currentHeartRateBpm: 140,
      currentResistanceLevel: 7,
      currentDistanceMeters: 575,
      savedBikeId: 'bike-1',
      savedBikeName: 'Bike',
      savedHrId: 'hr-1',
      savedHrName: 'HR',
      uploadState: null,
      createdAtMs: 100,
      updatedAtMs: 350,
    });

    const session = getLatestOpenSession();

    expect(session).toEqual({
      id: 'session-1',
      status: 'paused',
      startedAtMs: 100,
      endedAtMs: null,
      elapsedSeconds: 10,
      totalDistanceMeters: 75.5,
      totalCaloriesKcal: 11.25,
      currentMetrics: {
        speed: 25,
        cadence: 80,
        power: 180,
        heartRate: 140,
        resistance: 7,
        distance: 575,
      },
      savedBikeSnapshot: { id: 'bike-1', name: 'Bike' },
      savedHrSnapshot: { id: 'hr-1', name: 'HR' },
      uploadState: null,
      createdAtMs: 100,
      updatedAtMs: 350,
    });
  });

  it('returns null when no open session exists', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue(null);

    const session = getLatestOpenSession();

    expect(session).toBeNull();
  });

  it('returns a session by id when one exists', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue({
      id: 'session-2',
      status: 'finished',
      startedAtMs: 100,
      endedAtMs: 500,
      elapsedSeconds: 50,
      totalDistanceMeters: 250,
      totalCaloriesKcal: 25,
      currentSpeedKmh: 10,
      currentCadenceRpm: 75,
      currentPowerWatts: 180,
      currentHeartRateBpm: 135,
      currentResistanceLevel: 4,
      currentDistanceMeters: 250,
      savedBikeId: null,
      savedBikeName: null,
      savedHrId: null,
      savedHrName: null,
      uploadState: 'ready',
      createdAtMs: 100,
      updatedAtMs: 500,
    });

    expect(getSessionById('session-2')?.id).toBe('session-2');
    expect(database.getFirstSync).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'), 'session-2');
  });

  it('returns the latest finished session', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue({
      id: 'session-3',
      status: 'finished',
      startedAtMs: 100,
      endedAtMs: 700,
      elapsedSeconds: 60,
      totalDistanceMeters: 400,
      totalCaloriesKcal: 40,
      currentSpeedKmh: 0,
      currentCadenceRpm: 0,
      currentPowerWatts: 0,
      currentHeartRateBpm: null,
      currentResistanceLevel: null,
      currentDistanceMeters: 400,
      savedBikeId: null,
      savedBikeName: null,
      savedHrId: null,
      savedHrName: null,
      uploadState: 'uploaded',
      createdAtMs: 100,
      updatedAtMs: 700,
    });

    expect(getLatestFinishedSession()?.id).toBe('session-3');
    expect(database.getFirstSync).toHaveBeenCalledWith(expect.stringContaining('WHERE status = ?'), 'finished');
  });

  it('returns finished sessions in descending end-date order', () => {
    const database = buildDatabase();
    database.getAllSync.mockReturnValue([
      {
        id: 'session-5',
        status: 'finished',
        startedAtMs: 200,
        endedAtMs: 900,
        elapsedSeconds: 180,
        totalDistanceMeters: 1500,
        totalCaloriesKcal: 45,
        currentSpeedKmh: 0,
        currentCadenceRpm: 0,
        currentPowerWatts: 0,
        currentHeartRateBpm: null,
        currentResistanceLevel: null,
        currentDistanceMeters: 1500,
        savedBikeId: null,
        savedBikeName: null,
        savedHrId: null,
        savedHrName: null,
        uploadState: 'uploaded',
        createdAtMs: 200,
        updatedAtMs: 900,
      },
      {
        id: 'session-4',
        status: 'finished',
        startedAtMs: 100,
        endedAtMs: 700,
        elapsedSeconds: 120,
        totalDistanceMeters: 1000,
        totalCaloriesKcal: 35,
        currentSpeedKmh: 0,
        currentCadenceRpm: 0,
        currentPowerWatts: 0,
        currentHeartRateBpm: null,
        currentResistanceLevel: null,
        currentDistanceMeters: 1000,
        savedBikeId: null,
        savedBikeName: null,
        savedHrId: null,
        savedHrName: null,
        uploadState: 'ready',
        createdAtMs: 100,
        updatedAtMs: 700,
      },
    ]);

    expect(getFinishedSessions().map((session) => session.id)).toEqual(['session-5', 'session-4']);
    expect(database.getAllSync).toHaveBeenCalledWith(expect.stringContaining('WHERE status = ?'), 'finished');
    expect(database.getAllSync.mock.calls[0]?.[0]).toContain('ORDER BY ended_at_ms DESC');
  });

  it('returns all samples for a session in sequence order', () => {
    const database = buildDatabase();
    database.getAllSync.mockReturnValue([
      {
        id: 'sample-1',
        sessionId: 'session-1',
        sequence: 0,
        recordedAtMs: 100,
        elapsedSeconds: 1,
        speedKmh: 20,
        cadenceRpm: 80,
        powerWatts: 200,
        heartRateBpm: 140,
        resistanceLevel: 5,
        distanceMeters: 100,
      },
    ]);

    expect(getSamplesBySessionId('session-1')).toEqual([
      {
        id: 'sample-1',
        sessionId: 'session-1',
        sequence: 0,
        recordedAtMs: 100,
        elapsedSeconds: 1,
        metrics: {
          speed: 20,
          cadence: 80,
          power: 200,
          heartRate: 140,
          resistance: 5,
          distance: 100,
        },
      },
    ]);
  });

  it('returns -1 when a session has no persisted samples yet', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue({ maxSequence: null });

    expect(getLastSampleSequence('session-1')).toBe(-1);
  });

  it('returns the highest persisted sample sequence', () => {
    const database = buildDatabase();
    database.getFirstSync.mockReturnValue({ maxSequence: 7 });

    expect(getLastSampleSequence('session-1')).toBe(7);
  });

  it('finalizes stale open sessions using their last updated timestamp', () => {
    const database = buildDatabase();
    database.getAllSync.mockReturnValue([
      {
        id: 'session-stale',
        status: 'paused',
        startedAtMs: 100,
        endedAtMs: null,
        elapsedSeconds: 55,
        totalDistanceMeters: 1200,
        totalCaloriesKcal: 35,
        currentSpeedKmh: 0,
        currentCadenceRpm: 0,
        currentPowerWatts: 0,
        currentHeartRateBpm: 140,
        currentResistanceLevel: 6,
        currentDistanceMeters: 1200,
        savedBikeId: null,
        savedBikeName: null,
        savedHrId: null,
        savedHrName: null,
        uploadState: null,
        createdAtMs: 100,
        updatedAtMs: 500,
      },
    ]);
    database.getFirstSync.mockReturnValue({
      id: 'session-stale',
      status: 'finished',
      startedAtMs: 100,
      endedAtMs: 500,
      elapsedSeconds: 55,
      totalDistanceMeters: 1200,
      totalCaloriesKcal: 35,
      currentSpeedKmh: 0,
      currentCadenceRpm: 0,
      currentPowerWatts: 0,
      currentHeartRateBpm: 140,
      currentResistanceLevel: 6,
      currentDistanceMeters: 1200,
      savedBikeId: null,
      savedBikeName: null,
      savedHrId: null,
      savedHrName: null,
      uploadState: 'ready',
      createdAtMs: 100,
      updatedAtMs: 500,
    });

    const finalizedSessions = finalizeStaleOpenSessions(1000, 200);

    expect(database.runSync.mock.calls[0]).toContain('finished');
    expect(database.runSync.mock.calls[0]).toContain(500);
    expect(finalizedSessions).toHaveLength(1);
    expect(finalizedSessions[0]?.status).toBe('finished');
  });

  it('leaves fresh open sessions untouched during stale finalization', () => {
    const database = buildDatabase();
    database.getAllSync.mockReturnValue([]);

    expect(finalizeStaleOpenSessions(1000, 200)).toEqual([]);
    expect(database.runSync).not.toHaveBeenCalled();
  });

  it('normalizes recovered active sessions to paused without touching updated_at_ms', () => {
    const database = buildDatabase();
    database.getFirstSync
      .mockReturnValueOnce({
        id: 'session-active',
        status: 'active',
        startedAtMs: 100,
        endedAtMs: null,
        elapsedSeconds: 40,
        totalDistanceMeters: 800,
        totalCaloriesKcal: 22,
        currentSpeedKmh: 18,
        currentCadenceRpm: 82,
        currentPowerWatts: 180,
        currentHeartRateBpm: 141,
        currentResistanceLevel: 5,
        currentDistanceMeters: 800,
        savedBikeId: null,
        savedBikeName: null,
        savedHrId: null,
        savedHrName: null,
        uploadState: null,
        createdAtMs: 100,
        updatedAtMs: 400,
      })
      .mockReturnValueOnce({
        id: 'session-active',
        status: 'paused',
        startedAtMs: 100,
        endedAtMs: null,
        elapsedSeconds: 40,
        totalDistanceMeters: 800,
        totalCaloriesKcal: 22,
        currentSpeedKmh: 18,
        currentCadenceRpm: 82,
        currentPowerWatts: 180,
        currentHeartRateBpm: 141,
        currentResistanceLevel: 5,
        currentDistanceMeters: 800,
        savedBikeId: null,
        savedBikeName: null,
        savedHrId: null,
        savedHrName: null,
        uploadState: null,
        createdAtMs: 100,
        updatedAtMs: 400,
      });

    const normalizedSession = normalizeRecoveredSessionToPaused('session-active');

    expect(database.runSync).toHaveBeenCalledWith(
      'UPDATE training_sessions SET status = ? WHERE id = ? AND status = ?',
      'paused',
      'session-active',
      'active',
    );
    expect(normalizedSession?.status).toBe('paused');
  });

  it('deletes a persisted session with its samples and provider uploads in one transaction', () => {
    const database = buildDatabase();

    deleteSession('session-9');

    expect(database.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(database.runSync).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM session_provider_uploads WHERE session_id = ?',
      'session-9',
    );
    expect(database.runSync).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM training_session_samples WHERE session_id = ?',
      'session-9',
    );
    expect(database.runSync).toHaveBeenNthCalledWith(3, 'DELETE FROM training_sessions WHERE id = ?', 'session-9');
  });

  it('updates upload state with a fresh timestamp', () => {
    const database = buildDatabase();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234);

    updateUploadState('session-4', 'uploaded');

    expect(database.runSync).toHaveBeenCalledWith(
      'UPDATE training_sessions SET upload_state = ?, updated_at_ms = ? WHERE id = ?',
      'uploaded',
      1234,
      'session-4',
    );

    nowSpy.mockRestore();
  });
});
