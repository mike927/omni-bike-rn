import { useTrainingSessionStore } from '../trainingSessionStore';
import { TrainingPhase, type MetricSnapshot } from '../../types/training';

describe('trainingSessionStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    const store = useTrainingSessionStore.getState();
    // Force-reset regardless of current phase
    useTrainingSessionStore.setState({
      phase: TrainingPhase.Idle,
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    });
    void store; // suppress unused
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
      useTrainingSessionStore.getState().tick(makeSample());

      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(1);
    });

    it('should not increment when Paused', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeSample());
      useTrainingSessionStore.getState().pause();
      useTrainingSessionStore.getState().tick(makeSample());

      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(1);
    });

    it('should not increment when Idle', () => {
      useTrainingSessionStore.getState().tick(makeSample());
      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(0);
    });

    it('should accumulate totalDistance from speed', () => {
      useTrainingSessionStore.getState().start();
      // 36 km/h = 10 m/s → 10 m per tick
      useTrainingSessionStore.getState().tick(makeSample({ speed: 36 }));
      useTrainingSessionStore.getState().tick(makeSample({ speed: 36 }));

      expect(useTrainingSessionStore.getState().totalDistance).toBeCloseTo(20, 5);
    });

    it('should accumulate totalCalories from power', () => {
      useTrainingSessionStore.getState().start();
      // 4186 W for 1 s = 4186 J = 1 kcal
      useTrainingSessionStore.getState().tick(makeSample({ power: 4186 }));

      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(1, 5);
    });

    it('should update currentMetrics snapshot', () => {
      useTrainingSessionStore.getState().start();
      const sample = makeSample({ speed: 30, heartRate: 155 });
      useTrainingSessionStore.getState().tick(sample);

      expect(useTrainingSessionStore.getState().currentMetrics).toEqual(sample);
    });
  });

  describe('reset()', () => {
    it('should return all values to initial state', () => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(makeSample());
      useTrainingSessionStore.getState().tick(makeSample());
      useTrainingSessionStore.getState().finish();
      useTrainingSessionStore.getState().reset();

      const state = useTrainingSessionStore.getState();
      expect(state.phase).toBe(TrainingPhase.Idle);
      expect(state.elapsedSeconds).toBe(0);
      expect(state.totalDistance).toBe(0);
      expect(state.totalCalories).toBe(0);
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
