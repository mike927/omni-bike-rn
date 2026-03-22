import { MetronomeEngine } from '../MetronomeEngine';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import type { BikeMetrics } from '../../ble/BikeAdapter';

describe('MetronomeEngine', () => {
  let engine: MetronomeEngine;

  beforeEach(() => {
    jest.useFakeTimers();
    engine = new MetronomeEngine();

    // Reset stores using proper actions
    useDeviceConnectionStore.getState().clearAll();

    // Force store to a known state — finish + reset if needed, then raw reset for safety
    const store = useTrainingSessionStore;
    const { phase } = store.getState();
    if (phase === TrainingPhase.Active || phase === TrainingPhase.Paused) {
      store.getState().finish();
    }
    if (phase !== TrainingPhase.Idle && store.getState().phase === TrainingPhase.Finished) {
      store.getState().reset();
    }
    // Final safety: force Idle state
    store.setState({
      phase: TrainingPhase.Idle,
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      initialDistance: null,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    });
  });

  afterEach(() => {
    engine.stop();
    jest.useRealTimers();
  });

  describe('lifecycle', () => {
    it('should not be running initially', () => {
      expect(engine.isRunning()).toBe(false);
    });

    it('should be running after start()', () => {
      engine.start();
      expect(engine.isRunning()).toBe(true);
    });

    it('should stop running after stop()', () => {
      engine.start();
      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });

    it('should be a no-op if start() is called twice', () => {
      const spy = jest.spyOn(global, 'setInterval');
      engine.start();
      engine.start();
      // Only one interval should have been created
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should be safe to call stop() when not running', () => {
      expect(() => engine.stop()).not.toThrow();
    });
  });

  describe('tick behavior', () => {
    const bikeMetrics: BikeMetrics = {
      speed: 25,
      cadence: 80,
      power: 150,
      distance: 1000,
      resistance: 8,
      heartRate: 72,
    };

    it('should call trainingSessionStore.tick() on each interval', () => {
      // Put training store in Active phase so tick() actually processes
      useTrainingSessionStore.getState().start();
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);

      engine.start();
      jest.advanceTimersByTime(1000);

      // Verify tick was called by checking its side effect
      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(1);
    });

    it('should pass merged metrics from device store', () => {
      useTrainingSessionStore.getState().start();
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);

      engine.start();
      jest.advanceTimersByTime(1000);

      const state = useTrainingSessionStore.getState();
      expect(state.currentMetrics.speed).toBe(25);
      expect(state.currentMetrics.power).toBe(150);
    });

    it('should use default values when no device data is available', () => {
      useTrainingSessionStore.getState().start();
      // No device data set

      engine.start();
      jest.advanceTimersByTime(1000);

      const state = useTrainingSessionStore.getState();
      expect(state.currentMetrics.speed).toBe(0);
      expect(state.currentMetrics.cadence).toBe(0);
      expect(state.currentMetrics.power).toBe(0);
      expect(state.currentMetrics.heartRate).toBeNull();
    });
  });

  describe('HR priority', () => {
    it('should prefer external HR over bike HR', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 150,
        heartRate: 72,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateHr(145); // External HR

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(145);
    });

    it('should fall back to bike HR when no external HR is available', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 150,
        heartRate: 72,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      // No external HR set

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(72);
    });

    it('should return null HR when no source provides it', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 150,
        // No heartRate field
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBeNull();
    });
  });

  describe('accumulation over multiple ticks', () => {
    it('should accumulate elapsed time over multiple ticks', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = { speed: 36, cadence: 80, power: 150 };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);

      engine.start();
      jest.advanceTimersByTime(5000); // 5 ticks

      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(5);
    });
  });
});
