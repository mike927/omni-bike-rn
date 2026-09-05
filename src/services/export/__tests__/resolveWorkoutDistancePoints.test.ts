import { resolveWorkoutDistancePoints } from '../resolveWorkoutDistancePoints';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../types/sessionPersistence';

const BASE_SESSION: PersistedTrainingSession = {
  id: 'session-1',
  status: 'finished',
  startedAtMs: 1_700_000_000_000,
  endedAtMs: 1_700_000_004_000,
  elapsedSeconds: 4,
  totalDistanceMeters: 35,
  totalCaloriesKcal: 12,
  currentMetrics: { speed: 20, cadence: 80, power: 150, heartRate: null, resistance: null, distance: 25 },
  savedBikeSnapshot: null,
  savedHrSnapshot: null,
  uploadState: null,
  createdAtMs: 1_700_000_000_000,
  updatedAtMs: 1_700_000_004_000,
};

interface SampleSeed {
  readonly elapsedSeconds?: number;
  readonly speed?: number;
  readonly distance?: number | null;
  readonly sessionDistanceMeters?: number;
}

function makeSamples(seeds: readonly SampleSeed[]): PersistedTrainingSample[] {
  return seeds.map((seed, index) => {
    const elapsedSeconds = seed.elapsedSeconds ?? index + 1;
    const sample: PersistedTrainingSample = {
      id: `sample-${index + 1}`,
      sessionId: 'session-1',
      sequence: index + 1,
      recordedAtMs: BASE_SESSION.startedAtMs + elapsedSeconds * 1000,
      elapsedSeconds,
      metrics: {
        speed: seed.speed ?? 20,
        cadence: 80,
        power: 150,
        heartRate: null,
        resistance: null,
        distance: seed.distance === undefined ? null : seed.distance,
      },
    };

    return seed.sessionDistanceMeters === undefined
      ? sample
      : { ...sample, sessionDistanceMeters: seed.sessionDistanceMeters };
  });
}

/** The metres alone, which is what an export prints per trackpoint. */
function seriesFor(session: PersistedTrainingSession, samples: readonly PersistedTrainingSample[]): number[] {
  return resolveWorkoutDistancePoints(session, samples).map((point) => point.distanceMeters);
}

describe('resolveWorkoutDistancePoints', () => {
  it('returns an empty series for a ride with no samples', () => {
    expect(seriesFor(BASE_SESSION, [])).toEqual([]);
  });

  it('exports the recorded normalized total and ignores the raw counter beside it', () => {
    const samples = makeSamples([
      { distance: 500, sessionDistanceMeters: 0 },
      { distance: 520, sessionDistanceMeters: 20 },
      { distance: 10, sessionDistanceMeters: 20 },
      { distance: 25, sessionDistanceMeters: 35 },
    ]);

    expect(seriesFor(BASE_SESSION, samples)).toEqual([0, 20, 20, 35]);
  });

  it('rebases legacy counters onto the ride, including a mid-ride counter reset', () => {
    // Audit A07 reproduction: a 35 m ride stored as 500, 520, 10, 25.
    const samples = makeSamples([{ distance: 500 }, { distance: 520 }, { distance: 10 }, { distance: 25 }]);

    const series = seriesFor(BASE_SESSION, samples);

    expect(series).toEqual([0, 20, 20, 35]);
    expect(series.at(-1)).toBe(BASE_SESSION.totalDistanceMeters);
  });

  it('integrates speed for legacy rows the machine reported no counter for', () => {
    // 36 km/h is 10 m/s, so one metre-per-second step per sample.
    const samples = makeSamples([
      { speed: 36, distance: null },
      { speed: 36, distance: null },
    ]);

    expect(seriesFor(BASE_SESSION, samples)).toEqual([10, 20]);
  });

  it('holds a speed reading across a gap left by a sample write that failed', () => {
    const session: PersistedTrainingSession = { ...BASE_SESSION, totalDistanceMeters: 40 };
    const samples = makeSamples([
      { elapsedSeconds: 1, speed: 36, distance: null },
      { elapsedSeconds: 4, speed: 36, distance: null },
    ]);

    expect(seriesFor(session, samples)).toEqual([10, 40]);
  });

  it('replays a counter across a gap left by a sample write that failed', () => {
    // A02: a second that was counted and dropped. A counter replay does not
    // depend on the gap width, so this one stays exact.
    const session: PersistedTrainingSession = { ...BASE_SESSION, elapsedSeconds: 4, totalDistanceMeters: 30 };
    const samples = makeSamples([
      { elapsedSeconds: 1, distance: 500 },
      { elapsedSeconds: 2, distance: 510 },
      { elapsedSeconds: 4, distance: 530 },
    ]);

    expect(seriesFor(session, samples)).toEqual([0, 10, 30]);
  });

  it('caps a legacy replay at the stored total when a ride was resumed after an app kill', () => {
    // The trainer counted on to 600 m while the app was dead. `restore` clears
    // the rebasing state, so the live total ignored those metres and the ride
    // is 20 m long; an uncapped replay would export 0, 10, 110, 120.
    const session: PersistedTrainingSession = { ...BASE_SESSION, elapsedSeconds: 4, totalDistanceMeters: 20 };
    const samples = makeSamples([{ distance: 500 }, { distance: 510 }, { distance: 610 }, { distance: 620 }]);

    const series = seriesFor(session, samples);

    expect(series).toEqual([0, 10, 20, 20]);
    expect(series.at(-1)).toBe(session.totalDistanceMeters);
  });

  it('caps legacy rows at the stored total when recorded rows follow them across a restore', () => {
    // Killed after two pre-migration rows, resumed once the column existed.
    const session: PersistedTrainingSession = { ...BASE_SESSION, elapsedSeconds: 4, totalDistanceMeters: 20 };
    const samples = makeSamples([
      { distance: 500 },
      { distance: 510 },
      { distance: 610, sessionDistanceMeters: 10 },
      { distance: 620, sessionDistanceMeters: 20 },
    ]);

    expect(seriesFor(session, samples)).toEqual([0, 10, 10, 20]);
  });

  it('continues without a jump when legacy rows are followed by recorded ones', () => {
    const samples = makeSamples([
      { distance: 1000 },
      { distance: 1010 },
      { distance: 1020, sessionDistanceMeters: 20 },
      { distance: 1030, sessionDistanceMeters: 30 },
    ]);

    expect(seriesFor(BASE_SESSION, samples)).toEqual([0, 10, 20, 30]);
  });

  it('never decreases, because a TCX trackpoint distance is cumulative', () => {
    const samples = makeSamples([
      { sessionDistanceMeters: 0 },
      { sessionDistanceMeters: 20 },
      { sessionDistanceMeters: 15 },
      { sessionDistanceMeters: 30 },
    ]);

    expect(seriesFor(BASE_SESSION, samples)).toEqual([0, 20, 20, 30]);
  });

  it('spreads the stored total over elapsed time when a legacy ride reconstructs to nothing', () => {
    const session: PersistedTrainingSession = { ...BASE_SESSION, elapsedSeconds: 4, totalDistanceMeters: 40 };
    const samples = makeSamples([
      { speed: 0, distance: null },
      { speed: 0, distance: null },
      { speed: 0, distance: null },
      { speed: 0, distance: null },
    ]);

    expect(seriesFor(session, samples)).toEqual([10, 20, 30, 40]);
  });

  it('reports zeros rather than dividing by a zero-length ride', () => {
    const session: PersistedTrainingSession = { ...BASE_SESSION, elapsedSeconds: 0, totalDistanceMeters: 40 };
    const samples = makeSamples([{ elapsedSeconds: 0, speed: 0, distance: null }]);

    expect(seriesFor(session, samples)).toEqual([0]);
  });

  it('leaves a genuinely stationary recorded ride at zero instead of inventing distance', () => {
    const session: PersistedTrainingSession = { ...BASE_SESSION, elapsedSeconds: 2, totalDistanceMeters: 0 };
    const samples = makeSamples([
      { speed: 0, distance: 900, sessionDistanceMeters: 0 },
      { speed: 0, distance: 900, sessionDistanceMeters: 0 },
    ]);

    expect(seriesFor(session, samples)).toEqual([0, 0]);
  });
});
