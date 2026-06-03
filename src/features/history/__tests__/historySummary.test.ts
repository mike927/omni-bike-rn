import type { PersistedTrainingSession } from '../../../types/sessionPersistence';
import { deriveHistorySummary } from '../historySummary';

function buildSession(overrides: Partial<PersistedTrainingSession>): PersistedTrainingSession {
  return {
    id: 'session',
    status: 'finished',
    startedAtMs: 0,
    endedAtMs: null,
    elapsedSeconds: 0,
    totalDistanceMeters: 0,
    totalCaloriesKcal: 0,
    currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    savedBikeSnapshot: null,
    savedHrSnapshot: null,
    uploadState: null,
    createdAtMs: 0,
    updatedAtMs: 0,
    ...overrides,
  };
}

describe('deriveHistorySummary', () => {
  const now = new Date(2026, 4, 15); // May 2026

  it('aggregates rides, distance, and duration within the current month', () => {
    const sessions = [
      buildSession({
        id: 'a',
        startedAtMs: new Date(2026, 4, 30).getTime(),
        totalDistanceMeters: 18400,
        elapsedSeconds: 3720,
      }),
      buildSession({
        id: 'b',
        startedAtMs: new Date(2026, 4, 2).getTime(),
        totalDistanceMeters: 12100,
        elapsedSeconds: 2280,
      }),
    ];

    expect(deriveHistorySummary(sessions, now)).toEqual({
      rideCount: 2,
      totalDistanceMeters: 30500,
      totalDurationSeconds: 6000,
    });
  });

  it('excludes sessions from other months and other years', () => {
    const sessions = [
      buildSession({
        id: 'this-month',
        startedAtMs: new Date(2026, 4, 10).getTime(),
        totalDistanceMeters: 5000,
        elapsedSeconds: 600,
      }),
      buildSession({
        id: 'last-month',
        startedAtMs: new Date(2026, 3, 28).getTime(),
        totalDistanceMeters: 9999,
        elapsedSeconds: 9999,
      }),
      buildSession({
        id: 'last-year',
        startedAtMs: new Date(2025, 4, 10).getTime(),
        totalDistanceMeters: 8888,
        elapsedSeconds: 8888,
      }),
    ];

    expect(deriveHistorySummary(sessions, now)).toEqual({
      rideCount: 1,
      totalDistanceMeters: 5000,
      totalDurationSeconds: 600,
    });
  });

  it('returns zeros for no sessions', () => {
    expect(deriveHistorySummary([], now)).toEqual({
      rideCount: 0,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
    });
  });
});
