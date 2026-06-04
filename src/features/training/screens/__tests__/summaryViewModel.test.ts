import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../../types/sessionPersistence';
import { deriveSummaryView, downsamplePower, type EffortStat } from '../summaryViewModel';

const baseSession: PersistedTrainingSession = {
  id: 's1',
  status: 'finished',
  startedAtMs: Date.UTC(2026, 4, 30, 17, 42),
  endedAtMs: Date.UTC(2026, 4, 30, 18, 44),
  elapsedSeconds: 3738, // 1h 2m
  totalDistanceMeters: 28400,
  totalCaloriesKcal: 642.4,
  currentMetrics: { speed: 18.2, cadence: 81, power: 190, heartRate: 150, resistance: 6, distance: 28400 },
  savedBikeSnapshot: { id: 'b1', name: 'Wahoo KICKR Bike' },
  savedHrSnapshot: { id: 'h1', name: 'Polar H10' },
  uploadState: 'ready',
  createdAtMs: 0,
  updatedAtMs: 0,
};

function sample(
  power: number,
  heartRate: number | null,
  speed: number,
  cadence: number,
  seq: number,
): PersistedTrainingSample {
  return {
    id: `x${seq}`,
    sessionId: 's1',
    sequence: seq,
    recordedAtMs: seq * 1000,
    elapsedSeconds: seq,
    metrics: { speed, cadence, power, heartRate, resistance: null, distance: null },
  };
}

describe('deriveSummaryView', () => {
  it('builds the hero from session totals', () => {
    const vm = deriveSummaryView({ session: baseSession, samples: [] });
    expect(vm.hero.distance).toBe('28.4');
    expect(vm.hero.distanceUnit).toBe('km');
    expect(vm.hero.movingLabel).toBe('1h 2m');
    expect(vm.hero.caloriesLabel).toBe('642 kcal');
    expect(vm.hero.dateLabel).toMatch(/May 30/);
  });

  it('computes averages and peaks from samples', () => {
    const samples = [sample(200, 140, 30, 90, 0), sample(220, 160, 32, 94, 1)];
    const vm = deriveSummaryView({ session: baseSession, samples });
    const byKey = Object.fromEntries(vm.effort.map((e) => [e.key, e])) as Record<string, EffortStat>;
    expect(byKey['power']?.value).toBe('210');
    expect(byKey['power']?.peakLabel).toBe('220 W');
    expect(byKey['power']?.accent).toBe('power');
    expect(byKey['hr']?.value).toBe('150');
    expect(byKey['hr']?.peakLabel).toBe('160 bpm');
    expect(byKey['hr']?.accent).toBe('hr');
    expect(byKey['speed']?.value).toBe('31.0');
    expect(byKey['speed']?.peakLabel).toBe('32.0 km/h');
    expect(byKey['cadence']?.value).toBe('92');
  });

  it('falls back to final metrics with no peak when samples are empty', () => {
    const vm = deriveSummaryView({ session: baseSession, samples: [] });
    const power = vm.effort.find((e) => e.key === 'power');
    expect(power).toBeDefined();
    expect(power?.value).toBe('190');
    expect(power?.peakLabel).toBeNull();
  });

  it('shows -- for heart rate when no HR is available anywhere', () => {
    const noHrSession = { ...baseSession, currentMetrics: { ...baseSession.currentMetrics, heartRate: null } };
    const samples = [sample(200, null, 30, 90, 0)];
    const vm = deriveSummaryView({ session: noHrSession, samples });
    const hr = vm.effort.find((e) => e.key === 'hr');
    expect(hr).toBeDefined();
    expect(hr?.value).toBe('--');
    expect(hr?.peakLabel).toBeNull();
  });

  it('shows -- for HR when samples exist but never recorded HR, ignoring the final snapshot', () => {
    // The ride recorded data but had no HR source; the final snapshot still carries a
    // stale HR (145). With samples present we trust the samples, so HR reads "--".
    const samples = [sample(200, null, 30, 90, 0), sample(220, null, 32, 94, 1)];
    const vm = deriveSummaryView({ session: baseSession, samples });
    const hr = vm.effort.find((e) => e.key === 'hr');
    expect(hr?.value).toBe('--');
    expect(hr?.peakLabel).toBeNull();
    // Power still averages from the samples — the fallback is per-ride, not per-metric.
    expect(vm.effort.find((e) => e.key === 'power')?.value).toBe('210');
  });

  it('downsamples a long power series to 12 averaged buckets', () => {
    const powers = Array.from({ length: 60 }, (_, i) => i);
    expect(downsamplePower(powers).length).toBe(12);
    const vm = deriveSummaryView({
      session: baseSession,
      samples: powers.map((p, i) => sample(p, 150, 30, 90, i)),
    });
    expect(vm.powerTrend.length).toBe(12);
  });

  it('passes short power series through unchanged and is empty with no samples', () => {
    expect(downsamplePower([10, 20, 30])).toEqual([10, 20, 30]);
    expect(deriveSummaryView({ session: baseSession, samples: [] }).powerTrend).toEqual([]);
  });

  it('joins gear names and handles missing snapshots', () => {
    expect(deriveSummaryView({ session: baseSession, samples: [] }).gearLabel).toBe('Wahoo KICKR Bike · Polar H10');
    const noHr = { ...baseSession, savedHrSnapshot: null };
    expect(deriveSummaryView({ session: noHr, samples: [] }).gearLabel).toBe('Wahoo KICKR Bike');
    const none = { ...baseSession, savedBikeSnapshot: null, savedHrSnapshot: null };
    expect(deriveSummaryView({ session: none, samples: [] }).gearLabel).toBeNull();
  });
});
