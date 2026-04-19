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
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      lastBikeDistance: null,
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
      lastCalorieSourceMode: 'none',
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

    it('should use bike-reported calories when no live external HR is present', () => {
      useTrainingSessionStore.getState().start();
      useDeviceConnectionStore.getState().updateBikeMetrics({
        speed: 25,
        cadence: 80,
        power: 150,
        totalEnergyKcal: 200,
      });

      engine.start();
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().totalCalories).toBe(0);

      useDeviceConnectionStore.getState().updateBikeMetrics({
        speed: 25,
        cadence: 80,
        power: 150,
        totalEnergyKcal: 203,
      });

      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().totalCalories).toBe(3);
    });
  });

  describe('HR priority', () => {
    it('should prefer Bluetooth HR over bike HR', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 150,
        heartRate: 72,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(145);
    });

    it('should prefer Apple Watch HR over Bluetooth HR', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 150,
        heartRate: 72,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      useDeviceConnectionStore.getState().updateAppleWatchHr(158);

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(158);
    });

    it('should fall back to bike HR when no external source is available', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 150,
        heartRate: 72,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);

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

    it('should keep app-calculated calories when external HR is live even if bike energy is available', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 4186,
        heartRate: 72,
        totalEnergyKcal: 500,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(145);
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(4, 5);
    });
  });

  describe('Watch-computed calories', () => {
    it('should forward latestAppleWatchActiveKcal into the session store tick and mark the source as watch', () => {
      useTrainingSessionStore.getState().start();

      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(10);

      engine.start();
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');

      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(11);
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');
      expect(useTrainingSessionStore.getState().totalCalories).toBeCloseTo(1, 5);
    });

    it('should prefer Watch calories over the app-power formula when both are available', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25,
        cadence: 80,
        power: 4186,
        heartRate: 72,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      // HR also comes from the Watch payload — this establishes the freshness
      // timestamp the engine uses to gate the Watch branch.
      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(7);

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');
    });

    it('should drop stale Watch samples and fall back to app-power when the Watch stream goes silent', () => {
      useTrainingSessionStore.getState().start();

      useDeviceConnectionStore.getState().updateBluetoothHr(140);
      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 4186 });
      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(10);

      engine.start();
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');

      // No new Watch samples arrive. After the staleness timeout passes, the
      // engine must ignore the stale cumulative value and fall back to app-power.
      jest.advanceTimersByTime(6000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('app');
    });

    it('should resume the Watch branch when a fresh sample arrives after a staleness drop', () => {
      useTrainingSessionStore.getState().start();

      useDeviceConnectionStore.getState().updateBluetoothHr(140);
      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 4186 });
      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(10);

      engine.start();
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(6000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('app');

      // Fresh Watch sample refreshes the timestamp — next tick re-enters the Watch branch.
      useDeviceConnectionStore.getState().updateAppleWatchHr(152);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(11);
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');
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
