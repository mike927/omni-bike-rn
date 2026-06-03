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
      lastBikeDistance: null,
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
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
    watchActiveKcal: null,
    hasLiveExternalHr: false,
    keytelInputs: null,
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
      expect(state.lastBikeDistance).toBeNull();
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
      expect(state.lastBikeDistance).toBeNull();
      expect(state.lastCalorieSourceMode).toBe('none');
    });

    it('should return all values to initial state', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeTickInput({}, { watchActiveKcal: 10 }));
      useTrainingSessionStore.getState().tick(makeTickInput({}, { watchActiveKcal: 12 }));
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
      expect(state.lastBikeDistance).toBeNull();
      expect(state.watchCaloriesOffset).toBeNull();
      expect(state.lastWatchActiveKcal).toBeNull();
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

  describe('restore()', () => {
    it('hydrates a persisted session snapshot into Paused', () => {
      useTrainingSessionStore.getState().restore({
        elapsedSeconds: 120,
        totalDistance: 1500,
        totalCalories: 45.5,
        currentMetrics: makeSample({ speed: 0, cadence: 0, power: 0, distance: 1500 }),
      });

      const state = useTrainingSessionStore.getState();
      expect(state.phase).toBe(TrainingPhase.Paused);
      expect(state.elapsedSeconds).toBe(120);
      expect(state.totalDistance).toBe(1500);
      expect(state.totalCalories).toBe(45.5);
      expect(state.initialDistance).toBeNull();
      expect(state.bikeCaloriesOffset).toBeNull();
      expect(state.lastBikeTotalEnergyKcal).toBeNull();
      expect(state.lastBikeDistance).toBeNull();
      expect(state.watchCaloriesOffset).toBeNull();
      expect(state.lastWatchActiveKcal).toBeNull();
      expect(state.lastCalorieSourceMode).toBe('none');
    });

    it('rebases Watch calories on the first post-restore tick', () => {
      useTrainingSessionStore.getState().restore({
        elapsedSeconds: 90,
        totalDistance: 150,
        totalCalories: 20,
        currentMetrics: makeSample({ speed: 0, cadence: 0, power: 0, distance: null }),
      });

      useTrainingSessionStore.getState().resume();
      useTrainingSessionStore.getState().tick(makeTickInput({}, { watchActiveKcal: 400 }));

      const state = useTrainingSessionStore.getState();
      expect(state.totalCalories).toBeCloseTo(20, 5);
      expect(state.watchCaloriesOffset).toBeCloseTo(-380, 5);
      expect(state.lastWatchActiveKcal).toBe(400);
      expect(state.lastCalorieSourceMode).toBe('watch');
    });

    it('rebases distance and bike calories on the first post-restore tick', () => {
      useTrainingSessionStore.getState().restore({
        elapsedSeconds: 90,
        totalDistance: 150,
        totalCalories: 20,
        currentMetrics: makeSample({ speed: 0, cadence: 0, power: 0, distance: 780 }),
      });

      useTrainingSessionStore.getState().resume();
      useTrainingSessionStore.getState().tick(makeTickInput({ distance: 25 }, { bikeTotalEnergyKcal: 5 }));

      const state = useTrainingSessionStore.getState();
      expect(state.totalDistance).toBeCloseTo(150, 5);
      expect(state.totalCalories).toBeCloseTo(20, 5);
      expect(state.lastBikeDistance).toBe(25);
      expect(state.bikeCaloriesOffset).toBeCloseTo(15, 5);
      expect(state.lastBikeTotalEnergyKcal).toBe(5);
      expect(state.lastCalorieSourceMode).toBe('bike');
    });
  });
});
