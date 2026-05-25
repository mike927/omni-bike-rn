import { MetronomeEngine } from '../MetronomeEngine';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { useUserProfileStore } from '../../../store/userProfileStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import { TrainingPhase } from '../../../types/training';
import { EMPTY_USER_PROFILE } from '../../../types/userProfile';
import { HR_NO_SIGNAL_TIMEOUT_MS } from '../../hr/hrSource';
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
    // Profile store starts empty so engine passes keytelInputs: null and the
    // training store falls through to the existing power formula. Tests that
    // exercise the Keytel branch override this explicitly.
    useUserProfileStore.setState({ profile: { ...EMPTY_USER_PROFILE, sources: {} }, hydrated: false });
    // Gear store: no saved HR strap so the default fallback resolves to 'bike'.
    useSavedGearStore.setState({ savedHrSource: null });
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

  describe('HR locked source', () => {
    it('uses watch HR when activeHrSource is watch and the sample is fresh', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = { speed: 25, cadence: 80, power: 150, heartRate: 72 };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateAppleWatchHr(158);
      useDeviceConnectionStore.getState().setActiveHrSource('watch');

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(158);
    });

    it('returns null HR (not bike fallback) when activeHrSource is watch and watch is stale', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = { speed: 25, cadence: 80, power: 150, heartRate: 72 };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateAppleWatchHr(158);
      useDeviceConnectionStore.getState().setActiveHrSource('watch');

      engine.start();
      jest.advanceTimersByTime(1000);
      // Watch sample is fresh — HR is 158
      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(158);

      // Advance past the no-signal timeout without a new watch sample
      jest.advanceTimersByTime(HR_NO_SIGNAL_TIMEOUT_MS + 1000);

      // Must be null — must NOT fall through to bike HR (72)
      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBeNull();
    });

    it('uses Bluetooth HR when activeHrSource is bluetooth', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = { speed: 25, cadence: 80, power: 150, heartRate: 72 };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateAppleWatchHr(158);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      useDeviceConnectionStore.getState().setActiveHrSource('bluetooth');

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(145);
    });

    it('uses bike HR when activeHrSource is bike', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = { speed: 25, cadence: 80, power: 150, heartRate: 72 };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateAppleWatchHr(158);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      useDeviceConnectionStore.getState().setActiveHrSource('bike');

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBe(72);
    });

    it('hasLiveExternalHr is true for watch with a fresh sample', () => {
      useTrainingSessionStore.getState().start();

      useDeviceConnectionStore.getState().updateAppleWatchHr(158);
      useDeviceConnectionStore.getState().setActiveHrSource('watch');
      // Power is high enough that if bike were the calorie source the engine
      // would accumulate kcal; totalEnergyKcal is intentionally absent so the
      // only active calorie path is hasLiveExternalHr (app/power formula).
      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 4186 });

      engine.start();
      jest.advanceTimersByTime(1000);

      const state = useTrainingSessionStore.getState();
      expect(state.currentMetrics.heartRate).toBe(158);
      // hasLiveExternalHr = true → calorie source must not be 'bike'
      expect(state.lastCalorieSourceMode).toBe('app');
    });

    it('hasLiveExternalHr is false when activeHrSource is bike', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25, cadence: 80, power: 4186, heartRate: 72, totalEnergyKcal: 500,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().setActiveHrSource('bike');

      engine.start();
      // First tick establishes baseline kcal offset (200 kcal → 0 accumulated)
      jest.advanceTimersByTime(1000);

      useDeviceConnectionStore.getState().updateBikeMetrics({ ...bikeMetrics, totalEnergyKcal: 503 });
      jest.advanceTimersByTime(1000);

      // With hasLiveExternalHr = false (bike source), bike total energy kcal is used
      expect(useTrainingSessionStore.getState().totalCalories).toBe(3);
    });

    it('returns null HR when no source provides it and activeHrSource defaults to bike with no bike HR', () => {
      useTrainingSessionStore.getState().start();
      // No activeHrSource set (null), no saved HR strap, no watch → defaults to 'bike'
      // Bike has no heartRate field
      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 150 });

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().currentMetrics.heartRate).toBeNull();
    });

    it('should keep app-calculated calories when external HR is live (bluetooth source) even if bike energy is available', () => {
      useTrainingSessionStore.getState().start();

      const bikeMetrics: BikeMetrics = {
        speed: 25, cadence: 80, power: 4186, heartRate: 72, totalEnergyKcal: 500,
      };
      useDeviceConnectionStore.getState().updateBikeMetrics(bikeMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      useDeviceConnectionStore.getState().setActiveHrSource('bluetooth');

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
      useDeviceConnectionStore.getState().setActiveHrSource('watch');

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
      // HR also comes from the Watch payload — lock the source to watch so the
      // engine reads watch HR (and its freshness timestamp).
      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(7);
      useDeviceConnectionStore.getState().setActiveHrSource('watch');

      engine.start();
      jest.advanceTimersByTime(1000);

      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');
    });

    it('should drop stale Watch samples and stop using Watch kcal when the Watch stream goes silent', () => {
      useTrainingSessionStore.getState().start();

      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 4186, totalEnergyKcal: 100 });
      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(10);
      useDeviceConnectionStore.getState().setActiveHrSource('watch');

      engine.start();
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');

      // No new Watch samples arrive. After the no-signal timeout (HR_NO_SIGNAL_TIMEOUT_MS)
      // passes, the engine drops the stale Watch kcal — since watch is locked and stale,
      // hasLiveExternalHr is also false, so we fall through to bike-reported kcal.
      jest.advanceTimersByTime(HR_NO_SIGNAL_TIMEOUT_MS + 1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('bike');
    });

    it('should resume the Watch branch when a fresh sample arrives after a staleness drop', () => {
      useTrainingSessionStore.getState().start();

      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 4186, totalEnergyKcal: 100 });
      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(10);
      useDeviceConnectionStore.getState().setActiveHrSource('watch');

      engine.start();
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(HR_NO_SIGNAL_TIMEOUT_MS + 1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('bike');

      // Fresh Watch sample refreshes the timestamp — next tick re-enters the Watch branch.
      useDeviceConnectionStore.getState().updateAppleWatchHr(152);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(11);
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('watch');
    });
  });

  describe('Keytel HR-based personalized calories', () => {
    it('switches the source to keytel when the profile is complete and external HR is live', () => {
      useUserProfileStore.setState({
        profile: {
          sex: 'male',
          dateOfBirth: '1990-01-01',
          weightKg: 80,
          heightCm: 180,
          sources: {},
        },
        hydrated: true,
      });
      useTrainingSessionStore.getState().start();
      useDeviceConnectionStore.getState().updateBluetoothHr(150);
      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 4186 });
      useDeviceConnectionStore.getState().setActiveHrSource('bluetooth');

      engine.start();
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('keytel');
    });

    it('falls through to the power-based formula when the profile is incomplete', () => {
      useUserProfileStore.setState({
        profile: { sex: 'male', dateOfBirth: '1990-01-01', weightKg: null, heightCm: null, sources: {} },
        hydrated: true,
      });
      useTrainingSessionStore.getState().start();
      useDeviceConnectionStore.getState().updateBluetoothHr(150);
      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 25, cadence: 80, power: 4186 });
      useDeviceConnectionStore.getState().setActiveHrSource('bluetooth');

      engine.start();
      jest.advanceTimersByTime(1000);
      expect(useTrainingSessionStore.getState().lastCalorieSourceMode).toBe('app');
    });

    it('lets Watch active kcal beat keytel even with a complete profile', () => {
      useUserProfileStore.setState({
        profile: { sex: 'female', dateOfBirth: '1992-04-15', weightKg: 60, heightCm: 165, sources: {} },
        hydrated: true,
      });
      useTrainingSessionStore.getState().start();
      useDeviceConnectionStore.getState().updateAppleWatchHr(150);
      useDeviceConnectionStore.getState().updateAppleWatchActiveKcal(7);
      useDeviceConnectionStore.getState().setActiveHrSource('watch');

      engine.start();
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
