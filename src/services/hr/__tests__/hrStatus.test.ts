import {
  HR_CONNECTING_GRACE_SECONDS,
  WATCH_HR_UNAVAILABLE_HINT,
  hrSourceIdleReadiness,
  resolveHrSourceSummary,
  watchHrStatus,
} from '../hrStatus';
import { TrainingPhase } from '../../../types/training';

describe('watchHrStatus', () => {
  it('is off when Watch is not the primary source, regardless of availability', () => {
    expect(watchHrStatus(false, 'connected')).toBe('off');
    expect(watchHrStatus(false, 'unavailable')).toBe('off');
  });

  it('maps companion availability to ready/unavailable when Watch is primary', () => {
    expect(watchHrStatus(true, 'connected')).toBe('ready');
    expect(watchHrStatus(true, 'unavailable')).toBe('unavailable');
  });
});

describe('WATCH_HR_UNAVAILABLE_HINT', () => {
  it('exposes the canonical Watch-unavailable hint copy', () => {
    expect(WATCH_HR_UNAVAILABLE_HINT).toBe(
      'Open the Omni Bike app on your Apple Watch. If it is not installed yet, add it from the iPhone Watch app.',
    );
  });
});

describe('HR_CONNECTING_GRACE_SECONDS', () => {
  it('is 30 seconds', () => {
    expect(HR_CONNECTING_GRACE_SECONDS).toBe(30);
  });
});

describe('hrSourceIdleReadiness', () => {
  it('watch connected → ready', () => {
    expect(
      hrSourceIdleReadiness({
        source: 'watch',
        watchAvailability: 'connected',
        hrConnected: false,
        bikeConnected: false,
      }),
    ).toBe('ready');
  });

  it('watch unavailable → unavailable', () => {
    expect(
      hrSourceIdleReadiness({
        source: 'watch',
        watchAvailability: 'unavailable',
        hrConnected: false,
        bikeConnected: false,
      }),
    ).toBe('unavailable');
  });

  it('bluetooth connected → ready', () => {
    expect(
      hrSourceIdleReadiness({
        source: 'bluetooth',
        watchAvailability: 'unavailable',
        hrConnected: true,
        bikeConnected: false,
      }),
    ).toBe('ready');
  });

  it('bluetooth disconnected → unavailable', () => {
    expect(
      hrSourceIdleReadiness({
        source: 'bluetooth',
        watchAvailability: 'unavailable',
        hrConnected: false,
        bikeConnected: false,
      }),
    ).toBe('unavailable');
  });

  it('bike connected → ready', () => {
    expect(
      hrSourceIdleReadiness({
        source: 'bike',
        watchAvailability: 'unavailable',
        hrConnected: false,
        bikeConnected: true,
      }),
    ).toBe('ready');
  });

  it('bike disconnected → unavailable', () => {
    expect(
      hrSourceIdleReadiness({
        source: 'bike',
        watchAvailability: 'unavailable',
        hrConnected: false,
        bikeConnected: false,
      }),
    ).toBe('unavailable');
  });
});

describe('resolveHrSourceSummary', () => {
  // Explicit reading fixtures with the new awaitingFirstReading field
  const liveWatchReading = {
    source: 'watch' as const,
    bpm: 148,
    live: true,
    awaitingFirstReading: false,
  };
  const deadWatchReading = {
    source: 'watch' as const,
    bpm: null,
    live: false,
    awaitingFirstReading: false,
  };
  const neverConnectedWatchReading = {
    source: 'watch' as const,
    bpm: null,
    live: false,
    awaitingFirstReading: true,
  };
  const liveBtReading = {
    source: 'bluetooth' as const,
    bpm: 142,
    live: true,
    awaitingFirstReading: false,
  };
  const deadBtReading = {
    source: 'bluetooth' as const,
    bpm: null,
    live: false,
    awaitingFirstReading: false,
  };
  const liveBikeReading = {
    source: 'bike' as const,
    bpm: 135,
    live: true,
    awaitingFirstReading: false,
  };
  const deadBikeReading = {
    source: 'bike' as const,
    bpm: null,
    live: false,
    awaitingFirstReading: false,
  };

  // Common idle base: phase=Idle, elapsedSeconds=0, bikeConnected=true
  const idleBase = {
    primaryHrSource: 'bike' as const,
    watchAvailability: 'unavailable' as const,
    savedHrName: null,
    hrConnected: false,
    phase: TrainingPhase.Idle,
    elapsedSeconds: 0,
    bikeConnected: true,
  };

  // Common in-workout base: phase=Active, elapsedSeconds=60
  const activeBase = {
    primaryHrSource: 'bike' as const,
    watchAvailability: 'connected' as const,
    savedHrName: null,
    hrConnected: false,
    phase: TrainingPhase.Active,
    elapsedSeconds: 60,
    bikeConnected: true,
  };

  describe('in-workout (activeHrSource is set)', () => {
    it('watch locked + live → Apple Watch · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: liveWatchReading,
          ...activeBase,
          watchAvailability: 'connected',
        }),
      ).toEqual({ name: 'Apple Watch', status: 'ready' });
    });

    it('watch locked + no signal (had signal before) → Apple Watch · noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: deadWatchReading,
          ...activeBase,
          watchAvailability: 'unavailable',
        }),
      ).toEqual({ name: 'Apple Watch', status: 'noSignal' });
    });

    it('bluetooth locked + live → saved name · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: liveBtReading,
          ...activeBase,
          savedHrName: 'Polar H10',
          hrConnected: true,
          watchAvailability: 'unavailable',
        }),
      ).toEqual({ name: 'Polar H10', status: 'ready' });
    });

    it('bluetooth locked + no signal + null name → Bluetooth HR · noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: deadBtReading,
          ...activeBase,
          watchAvailability: 'unavailable',
        }),
      ).toEqual({ name: 'Bluetooth HR', status: 'noSignal' });
    });

    it('bike locked + live → Bike pulse · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bike',
          reading: liveBikeReading,
          ...activeBase,
          watchAvailability: 'unavailable',
        }),
      ).toEqual({ name: 'Bike pulse', status: 'ready' });
    });

    it('bike locked + no signal → Bike pulse · noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bike',
          reading: deadBikeReading,
          ...activeBase,
          watchAvailability: 'unavailable',
        }),
      ).toEqual({ name: 'Bike pulse', status: 'noSignal' });
    });

    it('never returns a different source than the locked one regardless of other signals', () => {
      const result = resolveHrSourceSummary({
        activeHrSource: 'bike',
        reading: liveBikeReading,
        ...activeBase,
        watchAvailability: 'connected',
        savedHrName: 'Garmin HRM',
        hrConnected: true,
      });
      expect(result.name).toBe('Bike pulse');
    });

    it('in-workout ignores primaryHrSource entirely', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: liveBtReading,
          ...activeBase,
          primaryHrSource: 'watch',
          watchAvailability: 'connected',
          savedHrName: 'Garmin HRM',
          hrConnected: true,
        }),
      ).toEqual({ name: 'Garmin HRM', status: 'ready' });
    });

    // NEW: paused state
    it('in-workout + phase Paused (any reading) → paused', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: liveWatchReading,
          ...activeBase,
          phase: TrainingPhase.Paused,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'paused' });
    });

    it('in-workout + phase Paused + no signal reading → still paused', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: deadWatchReading,
          ...activeBase,
          phase: TrainingPhase.Paused,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'paused' });
    });

    // NEW: connecting state (awaitingFirstReading + within grace)
    it('in-workout, awaitingFirstReading, elapsedSeconds <= grace → connecting', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: neverConnectedWatchReading,
          ...activeBase,
          elapsedSeconds: 10,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'connecting' });
    });

    it('in-workout, awaitingFirstReading, elapsedSeconds exactly at grace → connecting', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: neverConnectedWatchReading,
          ...activeBase,
          elapsedSeconds: HR_CONNECTING_GRACE_SECONDS,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'connecting' });
    });

    // NEW: grace expired → noSignal
    it('in-workout, awaitingFirstReading, elapsedSeconds > grace → noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: neverConnectedWatchReading,
          ...activeBase,
          elapsedSeconds: HR_CONNECTING_GRACE_SECONDS + 1,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'noSignal' });
    });

    // NEW: had signal then lost it (not awaiting) → noSignal regardless of elapsed
    it('in-workout, NOT awaiting (lost signal), any elapsed → noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: deadWatchReading,
          ...activeBase,
          elapsedSeconds: 5, // would be 'connecting' if awaitingFirstReading were true
        }),
      ).toEqual({ name: 'Apple Watch', status: 'noSignal' });
    });
  });

  describe('idle (activeHrSource is null)', () => {
    it('primary watch + availability connected → Apple Watch · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: liveWatchReading,
          ...idleBase,
          primaryHrSource: 'watch',
          watchAvailability: 'connected',
        }),
      ).toEqual({ name: 'Apple Watch', status: 'ready' });
    });

    it('primary watch + availability unavailable → Apple Watch · unavailable', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadWatchReading,
          ...idleBase,
          primaryHrSource: 'watch',
          watchAvailability: 'unavailable',
        }),
      ).toEqual({ name: 'Apple Watch', status: 'unavailable' });
    });

    it('primary bluetooth + connected → saved name · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: liveBtReading,
          ...idleBase,
          primaryHrSource: 'bluetooth',
          watchAvailability: 'unavailable',
          savedHrName: 'Polar H10',
          hrConnected: true,
        }),
      ).toEqual({ name: 'Polar H10', status: 'ready' });
    });

    it('primary bluetooth + disconnected → saved name · unavailable', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBtReading,
          ...idleBase,
          primaryHrSource: 'bluetooth',
          watchAvailability: 'unavailable',
          savedHrName: 'Polar H10',
          hrConnected: false,
        }),
      ).toEqual({ name: 'Polar H10', status: 'unavailable' });
    });

    it('primary bluetooth + null name + disconnected → Bluetooth HR · unavailable', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBtReading,
          ...idleBase,
          primaryHrSource: 'bluetooth',
          watchAvailability: 'unavailable',
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bluetooth HR', status: 'unavailable' });
    });

    it('primary bike + bikeConnected → Bike pulse · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBikeReading,
          ...idleBase,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          bikeConnected: true,
        }),
      ).toEqual({ name: 'Bike pulse', status: 'ready' });
    });

    it('primary bike + bikeConnected false → Bike pulse · unavailable', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBikeReading,
          ...idleBase,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          bikeConnected: false,
        }),
      ).toEqual({ name: 'Bike pulse', status: 'unavailable' });
    });
  });
});
