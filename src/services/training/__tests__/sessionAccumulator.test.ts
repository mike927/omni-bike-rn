import { advanceSession } from '../sessionAccumulator';
import type { MetricSnapshot, SessionAccumulator, TrainingTickInput } from '../../../types/training';

const INITIAL_METRICS: MetricSnapshot = {
  speed: 0,
  cadence: 0,
  power: 0,
  heartRate: null,
  resistance: null,
  distance: null,
};

const makeState = (overrides: Partial<SessionAccumulator> = {}): SessionAccumulator => ({
  elapsedSeconds: 0,
  totalDistance: 0,
  totalCalories: 0,
  currentMetrics: INITIAL_METRICS,
  initialDistance: null,
  bikeCaloriesOffset: null,
  lastBikeTotalEnergyKcal: null,
  lastBikeDistance: null,
  watchCaloriesOffset: null,
  lastWatchActiveKcal: null,
  lastCalorieSourceMode: 'none',
  ...overrides,
});

const makeSample = (overrides: Partial<MetricSnapshot> = {}): MetricSnapshot => ({
  speed: 25,
  cadence: 80,
  power: 150,
  heartRate: 140,
  resistance: 8,
  distance: null,
  ...overrides,
});

const makeTickInput = (
  metricOverrides: Partial<MetricSnapshot> = {},
  overrides: Partial<TrainingTickInput> = {},
): TrainingTickInput => ({
  metrics: makeSample(metricOverrides),
  bikeTotalEnergyKcal: null,
  watchActiveKcal: null,
  hasLiveExternalHr: false,
  keytelInputs: null,
  ...overrides,
});

describe('advanceSession', () => {
  it('increments elapsedSeconds by one per call', () => {
    expect(advanceSession(makeState(), makeTickInput()).elapsedSeconds).toBe(1);
  });

  it('accumulates totalDistance from speed', () => {
    let s = makeState();
    // 36 km/h = 10 m/s → 10 m per tick
    s = advanceSession(s, makeTickInput({ speed: 36 }));
    s = advanceSession(s, makeTickInput({ speed: 36 }));
    expect(s.totalDistance).toBeCloseTo(20, 5);
  });

  it('accumulates totalCalories from power adjusted for metabolic efficiency when external HR is live', () => {
    // 4186 W for 1 s = 4186 J mechanical = 1 kcal mechanical
    // Divided by 0.25 gross efficiency = 4 kcal metabolic
    const s = advanceSession(makeState(), makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
    expect(s.totalCalories).toBeCloseTo(4, 5);
  });

  it('holds totalCalories when external HR is absent and bike calories are unavailable', () => {
    const s = advanceSession(makeState(), makeTickInput({ power: 4186 }));
    expect(s.totalCalories).toBe(0);
  });

  it('follows normalized bike calories when external HR is absent', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 100 }));
    expect(s.totalCalories).toBe(0);

    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 103 }));
    expect(s.totalCalories).toBe(3);
  });

  it('switches from app-calculated calories to bike calories without a jump', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
    expect(s.totalCalories).toBeCloseTo(4, 5);

    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 120 }));
    expect(s.totalCalories).toBeCloseTo(4, 5);

    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 122 }));
    expect(s.totalCalories).toBeCloseTo(6, 5);
  });

  it('switches from bike calories back to app-calculated calories continuously', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 80 }));
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 82 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
    expect(s.totalCalories).toBeCloseTo(6, 5);
    expect(s.bikeCaloriesOffset).toBeNull();
  });

  it('rebases bike calories again after a no-data gap', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 50 }));
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 52 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput());
    expect(s.totalCalories).toBeCloseTo(2, 5);
    expect(s.bikeCaloriesOffset).toBeNull();

    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 60 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);
    expect(s.bikeCaloriesOffset).toBeCloseTo(-58, 5);
  });

  it('rebases bike calories if the bike counter resets mid-session', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 80 }));
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 82 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 1 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 3 }));
    expect(s.totalCalories).toBeCloseTo(4, 5);
  });

  it('follows Watch cumulative active kcal via offset rebase', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 10 }));
    expect(s.lastCalorieSourceMode).toBe('watch');
    expect(s.totalCalories).toBeCloseTo(0, 5);

    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 11 }));
    expect(s.totalCalories).toBeCloseTo(1, 5);
  });

  it('switches from app-calculated calories to Watch calories without a jump', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
    expect(s.totalCalories).toBeCloseTo(8, 5);

    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 100 }));
    expect(s.totalCalories).toBeCloseTo(8, 5);
    expect(s.lastCalorieSourceMode).toBe('watch');

    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 101 }));
    expect(s.totalCalories).toBeCloseTo(9, 5);
  });

  it('switches from bike calories to Watch calories without a jump', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 50 }));
    s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 52 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 200 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);
    expect(s.bikeCaloriesOffset).toBeNull();

    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 202 }));
    expect(s.totalCalories).toBeCloseTo(4, 5);
  });

  it('continues seamlessly from Watch calories to app-calculated when the Watch drops', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 10 }));
    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 15 }));
    expect(s.totalCalories).toBeCloseTo(5, 5);

    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
    expect(s.totalCalories).toBeCloseTo(9, 5);
    expect(s.lastCalorieSourceMode).toBe('app');
    expect(s.watchCaloriesOffset).toBeNull();
  });

  it('rebases Watch calories if the Watch session counter resets mid-ride', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 30 }));
    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 32 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 1 }));
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput({}, { watchActiveKcal: 3 }));
    expect(s.totalCalories).toBeCloseTo(4, 5);
  });

  it('prefers Watch calories over the app-power formula when both are present', () => {
    const s = advanceSession(
      makeState(),
      makeTickInput({ power: 4186 }, { hasLiveExternalHr: true, watchActiveKcal: 10 }),
    );
    expect(s.lastCalorieSourceMode).toBe('watch');
  });

  it('uses the app-power formula while Watch active kcal has not yet arrived, then rebases seamlessly when it does', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true, watchActiveKcal: null }));
    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true, watchActiveKcal: null }));
    expect(s.totalCalories).toBeCloseTo(8, 5);
    expect(s.lastCalorieSourceMode).toBe('app');

    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true, watchActiveKcal: 500 }));
    expect(s.totalCalories).toBeCloseTo(8, 5);
    expect(s.lastCalorieSourceMode).toBe('watch');

    s = advanceSession(s, makeTickInput({ power: 4186 }, { hasLiveExternalHr: true, watchActiveKcal: 501 }));
    expect(s.totalCalories).toBeCloseTo(9, 5);
  });

  it('rebases bike distance if the bike counter resets mid-session', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({ distance: 500 }));
    s = advanceSession(s, makeTickInput({ distance: 520 }));
    expect(s.totalDistance).toBeCloseTo(20, 5);

    s = advanceSession(s, makeTickInput({ distance: 10 }));
    expect(s.totalDistance).toBeCloseTo(20, 5);

    s = advanceSession(s, makeTickInput({ distance: 25 }));
    expect(s.totalDistance).toBeCloseTo(35, 5);
  });

  it('keeps distance and bike calories monotonic when both counters reset together', () => {
    let s = makeState();
    s = advanceSession(s, makeTickInput({ distance: 500 }, { bikeTotalEnergyKcal: 100 }));
    s = advanceSession(s, makeTickInput({ distance: 520 }, { bikeTotalEnergyKcal: 102 }));
    expect(s.totalDistance).toBeCloseTo(20, 5);
    expect(s.totalCalories).toBeCloseTo(2, 5);

    s = advanceSession(s, makeTickInput({ distance: 10 }, { bikeTotalEnergyKcal: 1 }));
    expect(s.totalDistance).toBeCloseTo(20, 5);
    expect(s.totalCalories).toBeCloseTo(2, 5);
  });

  it('updates currentMetrics snapshot', () => {
    const sample = makeSample({ speed: 30, heartRate: 155 });
    const s = advanceSession(makeState(), makeTickInput({ speed: 30, heartRate: 155 }));
    expect(s.currentMetrics).toEqual(sample);
  });

  describe('Keytel HR-based personalized calories', () => {
    const KEYTEL = { sex: 'male' as const, ageYears: 35, weightKg: 80 };

    it('uses the Keytel formula when external HR + complete profile + heart rate are present', () => {
      const s = advanceSession(
        makeState(),
        makeTickInput({ heartRate: 150 }, { hasLiveExternalHr: true, keytelInputs: KEYTEL }),
      );
      expect(s.lastCalorieSourceMode).toBe('keytel');
      // Reference: ((-55.0969 + 0.6309*150 + 0.1988*80 + 0.2017*35) / 4.184) / 60 ≈ 0.249 kcal/s
      expect(s.totalCalories).toBeCloseTo(0.249, 2);
    });

    it('falls through to the power-based formula when keytelInputs is null', () => {
      const s = advanceSession(
        makeState(),
        makeTickInput({ power: 4186, heartRate: 150 }, { hasLiveExternalHr: true, keytelInputs: null }),
      );
      expect(s.lastCalorieSourceMode).toBe('app');
      expect(s.totalCalories).toBeCloseTo(4, 5);
    });

    it('falls through to the power-based formula when heart rate is missing on this tick', () => {
      const s = advanceSession(
        makeState(),
        makeTickInput({ power: 4186, heartRate: null }, { hasLiveExternalHr: true, keytelInputs: KEYTEL }),
      );
      expect(s.lastCalorieSourceMode).toBe('app');
      expect(s.totalCalories).toBeCloseTo(4, 5);
    });

    it('lets Watch active kcal beat Keytel when both are present', () => {
      const s = advanceSession(
        makeState(),
        makeTickInput({ heartRate: 150 }, { hasLiveExternalHr: true, keytelInputs: KEYTEL, watchActiveKcal: 10 }),
      );
      expect(s.lastCalorieSourceMode).toBe('watch');
    });

    it('switches from Keytel to Watch without a calorie jump', () => {
      let s = makeState();
      s = advanceSession(s, makeTickInput({ heartRate: 150 }, { hasLiveExternalHr: true, keytelInputs: KEYTEL }));
      s = advanceSession(s, makeTickInput({ heartRate: 150 }, { hasLiveExternalHr: true, keytelInputs: KEYTEL }));
      const before = s.totalCalories;

      s = advanceSession(
        s,
        makeTickInput({ heartRate: 150 }, { hasLiveExternalHr: true, keytelInputs: KEYTEL, watchActiveKcal: 200 }),
      );
      expect(s.totalCalories).toBeCloseTo(before, 5);
      expect(s.lastCalorieSourceMode).toBe('watch');
    });

    it('switches from Keytel to bike calories without a jump when HR drops away', () => {
      let s = makeState();
      s = advanceSession(s, makeTickInput({ heartRate: 150 }, { hasLiveExternalHr: true, keytelInputs: KEYTEL }));
      const after1 = s.totalCalories;

      s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 500 }));
      expect(s.totalCalories).toBeCloseTo(after1, 5);
      expect(s.lastCalorieSourceMode).toBe('bike');

      s = advanceSession(s, makeTickInput({}, { bikeTotalEnergyKcal: 502 }));
      expect(s.totalCalories).toBeCloseTo(after1 + 2, 5);
    });
  });
});
