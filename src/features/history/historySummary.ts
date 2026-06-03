import type { PersistedTrainingSession } from '../../types/sessionPersistence';

export interface HistorySummary {
  readonly rideCount: number;
  readonly totalDistanceMeters: number;
  readonly totalDurationSeconds: number;
}

const EMPTY_SUMMARY: HistorySummary = {
  rideCount: 0,
  totalDistanceMeters: 0,
  totalDurationSeconds: 0,
};

/**
 * Aggregate ride count, distance, and duration for the calendar month that `now` falls in.
 * `now` is injectable so the summary is deterministic in tests.
 */
export function deriveHistorySummary(sessions: readonly PersistedTrainingSession[], now: Date): HistorySummary {
  const month = now.getMonth();
  const year = now.getFullYear();

  return sessions.reduce<HistorySummary>((acc, session) => {
    const startedAt = new Date(session.startedAtMs);
    if (startedAt.getMonth() !== month || startedAt.getFullYear() !== year) {
      return acc;
    }
    return {
      rideCount: acc.rideCount + 1,
      totalDistanceMeters: acc.totalDistanceMeters + session.totalDistanceMeters,
      totalDurationSeconds: acc.totalDurationSeconds + session.elapsedSeconds,
    };
  }, EMPTY_SUMMARY);
}
