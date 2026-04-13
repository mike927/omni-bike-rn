import { useTrainingSessionStore } from '../trainingSessionStore';
import { TrainingPhase, type MetricSnapshot, type TrainingTickInput } from '../../types/training';

describe('trainingSessionStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    // Force-reset regardless of current phase
    useTrainingSessionStore.setState({
      phase: TrainingPhase.Idle,
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      initialDistance: null,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      lastCalorieSourceMode: 'none',
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    });
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
    hasLiveExternalHr: false,
    ...overrides,
  });

  describe('state machine transitions', () => {
    it('should start in Idle phase', () => {
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    });

    it('should transition Idle → Active', () => {
      useTrainingSessionStore.getState().start();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
    });

    it('should transition Active → Paused', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().pause();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);
    });

    it('should transition Paused → Active (resume)', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().pause();
      useTrainingSessionStore.getState().resume();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
    });

    it('should transition Active → Finished', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().finish();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Finished);
    });

    it('should transition Paused → Finished', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().pause();
      useTrainingSessionStore.getState().finish();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Finished);
    });

    it('should transition Finished → Idle (reset)', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().finish();
      useTrainingSessionStore.getState().reset();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    });

    it('should complete full lifecycle: Idle → Active → Paused → Active → Finished → Idle', () => {
      const store = useTrainingSessionStore;
      store.getState().start();
      expect(store.getState().phase).toBe(TrainingPhase.Active);

      store.getState().pause();
      expect(store.getState().phase).toBe(TrainingPhase.Paused);

      store.getState().resume();
      expect(store.getState().phase).toBe(TrainingPhase.Active);

      store.getState().finish();
      expect(store.getState().phase).toBe(TrainingPhase.Finished);

      store.getState().reset();
      expect(store.getState().phase).toBe(TrainingPhase.Idle);
    });
  });

  describe('invalid transitions', () => {
    it('should reject pause() from Idle', () => {
      useTrainingSessionStore.getState().pause();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    });

    it('should reject finish() from Idle', () => {
      useTrainingSessionStore.getState().finish();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    });

    it('should reject start() from Active', () => {
      useTrainingSessionStore.getState().start();
      // Calling start() again should not change phase (already Active → Active is not a valid transition)
      useTrainingSessionStore.getState().start();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
    });

    it('should reject resume() from Idle', () => {
      useTrainingSessionStore.getState().resume();
      expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    });
  });

  describe('tick()', () => {
    it('should increment elapsedSeconds when Active', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeTickInput());

      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(1);
    });

    it('should not increment when Paused', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeTickInput());
      useTrainingSessionStore.getState().pause();
      useTrainingSessionStore.getState().tick(makeTickInput());

      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(1);
    });

    it('should not increment when Idle', () => {
      useTrainingSessionStore.getState().tick(makeTickInput());
      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(0);
    });

    it('should accumulate totalDistance from speed', () => {
      useTrainingSessionStore.getState().start();
      // 36 km/h = 10 m/s → 10 m per tick
      useTrainingSessionStore.getState().tick(makeTickInput({ speed: 36 }));
      useTrainingSessionStore.getState().tick(makeTickInput({ speed: 36 }));

      expect(useTrainingSessionStore.getState().totalDistance).toBeCloseTo(20, 5);
    });

    it('should accumulate totalCalories from power adjusted for metabolic efficiency when external HR is live', () => {
      useTrainingSessionStore.getState().start();
      // 4186 W for 1 s = 4186 J mechanical = 1 kcal mechanical
      // Divided by 0.25 gross efficiency = 4 kcal metabolic
      useTrainingSessionStore.getState().tick(makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));

      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(4, 5);
    });

    it('should hold totalCalories when external HR is absent and bike calories are unavailable', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeTickInput({ power: 4186 }));

      expect(useTrainingSessionStore.getState().totalCalories).toBe(0);
    });

    it('should follow normalized bike calories when external HR is absent', () => {
      useTrainingSessionStore.getState().start();

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 100 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBe(0);

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 103 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBe(3);
    });

    it('should switch from app-calculated calories to bike calories without a jump', () => {
      useTrainingSessionStore.getState().start();

      useTrainingSessionStore.getState().tick(makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(4, 5);

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 120 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(4, 5);

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 122 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(6, 5);
    });

    it('should switch from bike calories back to app-calculated calories continuously', () => {
      useTrainingSessionStore.getState().start();

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 80 }));
      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 82 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(2, 5);

      useTrainingSessionStore.getState().tick(makeTickInput({ power: 4186 }, { hasLiveExternalHr: true }));
      const state = useTrainingSessionStore.getState();

      expect(state.totalCalories).toBeCloseTo(6, 5);
      expect(state.bikeCaloriesOffset).toBeNull();
    });

    it('should rebase bike calories again after a no-data gap', () => {
      useTrainingSessionStore.getState().start();

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 50 }));
      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 52 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(2, 5);

      useTrainingSessionStore.getState().tick(makeTickInput());
      let state = useTrainingSessionStore.getState();
      expect(state.totalCalories).toBeCloseTo(2, 5);
      expect(state.bikeCaloriesOffset).toBeNull();

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 60 }));
      state = useTrainingSessionStore.getState();
      expect(state.totalCalories).toBeCloseTo(2, 5);
      expect(state.bikeCaloriesOffset).toBeCloseTo(-58, 5);
    });

    it('should rebase bike calories if the bike counter resets mid-session', () => {
      useTrainingSessionStore.getState().start();

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 80 }));
      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 82 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(2, 5);

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 1 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(2, 5);

      useTrainingSessionStore.getState().tick(makeTickInput({}, { bikeTotalEnergyKcal: 3 }));
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(4, 5);
    });

    it('should update currentMetrics snapshot', () => {
      useTrainingSessionStore.getState().start();
      const sample = makeSample({ speed: 30, heartRate: 155 });
      useTrainingSessionStore.getState().tick(makeTickInput({ speed: 30, heartRate: 155 }));

      expect(useTrainingSessionStore.getState().currentMetrics).toEqual(sample);
    });
  });

  describe('reset()', () => {
    it('should reset an active session back to Idle', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeTickInput({ distance: 500 }, { bikeTotalEnergyKcal: 75 }));

      useTrainingSessionStore.getState().reset();

      const state = useTrainingSessionStore.getState();
      expect(state.phase).toBe(TrainingPhase.Idle);
      expect(state.elapsedSeconds).toBe(0);
      expect(state.totalDistance).toBe(0);
      expect(state.totalCalories).toBe(0);
      expect(state.initialDistance).toBeNull();
      expect(state.bikeCaloriesOffset).toBeNull();
      expect(state.lastBikeTotalEnergyKcal).toBeNull();
      expect(state.lastCalorieSourceMode).toBe('none');
    });

    it('should reset a paused session back to Idle', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeTickInput({ distance: 500 }, { bikeTotalEnergyKcal: 75 }));
      useTrainingSessionStore.getState().pause();

      useTrainingSessionStore.getState().reset();

      const state = useTrainingSessionStore.getState();
      expect(state.phase).toBe(TrainingPhase.Idle);
      expect(state.elapsedSeconds).toBe(0);
      expect(state.totalDistance).toBe(0);
      expect(state.totalCalories).toBe(0);
      expect(state.initialDistance).toBeNull();
      expect(state.bikeCaloriesOffset).toBeNull();
      expect(state.lastBikeTotalEnergyKcal).toBeNull();
      expect(state.lastCalorieSourceMode).toBe('none');
    });

    it('should return all values to initial state', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeTickInput());
      useTrainingSessionStore.getState().tick(makeTickInput());
      useTrainingSessionStore.getState().finish();
      useTrainingSessionStore.getState().reset();

      const state = useTrainingSessionStore.getState();
      expect(state.phase).toBe(TrainingPhase.Idle);
      expect(state.elapsedSeconds).toBe(0);
      expect(state.totalDistance).toBe(0);
      expect(state.totalCalories).toBe(0);
      expect(state.initialDistance).toBeNull();
      expect(state.bikeCaloriesOffset).toBeNull();
      expect(state.lastBikeTotalEnergyKcal).toBeNull();
      expect(state.lastCalorieSourceMode).toBe('none');
      expect(state.currentMetrics).toEqual({
        speed: 0,
        cadence: 0,
        power: 0,
        heartRate: null,
        resistance: null,
        distance: null,
      });
    });
  });
});
