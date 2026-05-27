import { WATCH_HR_UNAVAILABLE_HINT, resolveHrSourceSummary, watchHrStatus } from '../hrStatus';

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

describe('resolveHrSourceSummary', () => {
  const liveWatchReading = { source: 'watch' as const, bpm: 148, live: true };
  const deadWatchReading = { source: 'watch' as const, bpm: null, live: false };
  const liveBtReading = { source: 'bluetooth' as const, bpm: 142, live: true };
  const deadBtReading = { source: 'bluetooth' as const, bpm: null, live: false };
  const liveBikeReading = { source: 'bike' as const, bpm: 135, live: true };
  const deadBikeReading = { source: 'bike' as const, bpm: null, live: false };

  describe('in-workout (activeHrSource is set)', () => {
    it('watch locked + live → Apple Watch · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: liveWatchReading,
          primaryHrSource: 'bike',
          watchAvailability: 'connected',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'ready' });
    });

    it('watch locked + no signal → Apple Watch · noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'watch',
          reading: deadWatchReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'noSignal' });
    });

    it('bluetooth locked + live → saved name · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: liveBtReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: 'Polar H10',
          hrConnected: true,
        }),
      ).toEqual({ name: 'Polar H10', status: 'ready' });
    });

    it('bluetooth locked + no signal + null name → Bluetooth HR · noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bluetooth',
          reading: deadBtReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bluetooth HR', status: 'noSignal' });
    });

    it('bike locked + live → Bike pulse · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bike',
          reading: liveBikeReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bike pulse', status: 'ready' });
    });

    it('bike locked + no signal → Bike pulse · noSignal', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: 'bike',
          reading: deadBikeReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bike pulse', status: 'noSignal' });
    });

    it('never returns a different source than the locked one regardless of other signals', () => {
      const result = resolveHrSourceSummary({
        activeHrSource: 'bike',
        reading: liveBikeReading,
        primaryHrSource: 'bike',
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
          primaryHrSource: 'watch',
          watchAvailability: 'connected',
          savedHrName: 'Garmin HRM',
          hrConnected: true,
        }),
      ).toEqual({ name: 'Garmin HRM', status: 'ready' });
    });
  });

  describe('idle (activeHrSource is null)', () => {
    it('primary watch + availability connected → Apple Watch · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: liveWatchReading,
          primaryHrSource: 'watch',
          watchAvailability: 'connected',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'ready' });
    });

    it('primary watch + availability unavailable → Apple Watch · unavailable', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadWatchReading,
          primaryHrSource: 'watch',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Apple Watch', status: 'unavailable' });
    });

    it('primary bluetooth + connected → saved name · ready', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: liveBtReading,
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
          primaryHrSource: 'bluetooth',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bluetooth HR', status: 'unavailable' });
    });

    it('primary bike → Bike pulse · ready (always available)', () => {
      expect(
        resolveHrSourceSummary({
          activeHrSource: null,
          reading: deadBikeReading,
          primaryHrSource: 'bike',
          watchAvailability: 'unavailable',
          savedHrName: null,
          hrConnected: false,
        }),
      ).toEqual({ name: 'Bike pulse', status: 'ready' });
    });
  });
});
