import {
  WATCH_HR_UNAVAILABLE_HINT,
  resolveHrSourceSummary,
  resolveWatchHrDisplayState,
  watchHrDisplayLabel,
} from '../hrStatus';

describe('resolveWatchHrDisplayState', () => {
  it('collapses to disabled when Watch HR is off, regardless of availability', () => {
    expect(resolveWatchHrDisplayState(false, 'in_progress')).toBe('disabled');
    expect(resolveWatchHrDisplayState(false, 'unavailable')).toBe('disabled');
  });

  it('passes the raw availability through when Watch HR is enabled', () => {
    expect(resolveWatchHrDisplayState(true, 'unavailable')).toBe('unavailable');
    expect(resolveWatchHrDisplayState(true, 'idle')).toBe('idle');
    expect(resolveWatchHrDisplayState(true, 'in_progress')).toBe('in_progress');
  });
});

describe('label helpers', () => {
  it('maps Watch HR display states to human labels', () => {
    expect(watchHrDisplayLabel('disabled')).toBe('Disabled');
    expect(watchHrDisplayLabel('unavailable')).toBe('Unavailable');
    expect(watchHrDisplayLabel('idle')).toBe('Idle');
    expect(watchHrDisplayLabel('in_progress')).toBe('Connected');
  });

  it('exposes the canonical Watch-unavailable hint copy', () => {
    expect(WATCH_HR_UNAVAILABLE_HINT).toBe(
      'Open the Omni Bike app on your Apple Watch. If it is not installed yet, add it from the iPhone Watch app.',
    );
  });
});

describe('resolveHrSourceSummary', () => {
  // In-workout base: activeHrSource is set, reading is live
  const liveWatchReading = { source: 'watch' as const, bpm: 148, live: true };
  const deadWatchReading = { source: 'watch' as const, bpm: null, live: false };
  const liveBtReading = { source: 'bluetooth' as const, bpm: 142, live: true };
  const deadBtReading = {
    source: 'bluetooth' as const,
    bpm: null,
    live: false,
  };
  const liveBikeReading = { source: 'bike' as const, bpm: 135, live: true };
  const deadBikeReading = { source: 'bike' as const, bpm: null, live: false };

  // ── In-workout: locked source ─────────────────────────────────────────────

  describe('in-workout (activeHrSource is set)', () => {
    it('watch locked + live → Apple Watch · Connected', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: liveWatchReading,
          primaryHrSource: 'bike',
          watchAvailability: 'in_progress',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', state: 'Connected' });
    });

    it('watch locked + no signal → Apple Watch · No signal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: deadWatchReading,
          primaryHrSource: 'bike',
          watchAvailability: 'idle',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', state: 'No signal' });
    });

    it('bluetooth locked + live → saved name · Connected', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: liveBtReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: 'Polar H10',
          hrConnected: true,
        }),
      ).toEqual({ name: 'Polar H10', state: 'Connected' });
    });

    it('bluetooth locked + no signal + null name → Bluetooth HR · No signal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: deadBtReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bluetooth HR', state: 'No signal' });
    });

    it('bike locked + live → Bike pulse · Connected', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bike',
          reading: liveBikeReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bike pulse', state: 'Connected' });
    });

    it('bike locked + no signal → Bike pulse · No signal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bike',
          reading: deadBikeReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bike pulse', state: 'No signal' });
    });

    it('never returns a different source than the locked one regardless of other signals', () => {
      // Bike locked, but BLE is also connected — must still show Bike
      const result = resolveHrSourceSummary({
        activeHrSource: 'bike',
        reading: liveBikeReading,
        primaryHrSource: 'bike',
        watchAvailability: 'in_progress',
        savedHrName: 'Garmin HRM',
        hrConnected: true,
      });
      expect(result.name).toBe('Bike pulse');
    });

    it('in-workout ignores primaryHrSource entirely', () => {
      // Even if primary says 'watch', the locked bluetooth source wins
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: liveBtReading,
          primaryHrSource: 'watch',
          watchAvailability: 'in_progress',
          savedHrName: 'Garmin HRM',
          hrConnected: true,
        }),
      ).toEqual({ name: 'Garmin HRM', state: 'Connected' });
    });
  });

  // ── Idle: primary source readiness ───────────────────────────────────────

  describe('idle (activeHrSource is null)', () => {
    it('primary watch + availability in_progress → Apple Watch · Connected', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: liveWatchReading,
          primaryHrSource: 'watch',
          watchAvailability: 'in_progress',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', state: 'Connected' });
    });

    it('primary watch + availability idle → Apple Watch · Idle', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadWatchReading,
          primaryHrSource: 'watch',
          watchAvailability: 'idle',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', state: 'Idle' });
    });

    it('primary watch + availability unavailable → Apple Watch · Unavailable', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadWatchReading,
          primaryHrSource: 'watch',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', state: 'Unavailable' });
    });

    it('primary bluetooth + connected → saved name · Connected', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: liveBtReading,
          primaryHrSource: 'bluetooth',
          watchAvailability: 'unavailable',
          savedHrName: 'Polar H10',
          hrConnected: true,
        }),
      ).toEqual({ name: 'Polar H10', state: 'Connected' });
    });

    it('primary bluetooth + disconnected → saved name · Disconnected', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBtReading,
          primaryHrSource: 'bluetooth',
          watchAvailability: 'unavailable',
          savedHrName: 'Polar H10',
          hrConnected: false,
        }),
      ).toEqual({ name: 'Polar H10', state: 'Disconnected' });
    });

    it('primary bluetooth + null name + disconnected → Bluetooth HR · Disconnected', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBtReading,
          primaryHrSource: 'bluetooth',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bluetooth HR', state: 'Disconnected' });
    });

    it('primary bike → Bike pulse · Connected (always available)', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBikeReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bike pulse', state: 'Connected' });
    });
  });
});
