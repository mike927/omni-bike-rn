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
  const base = {
    watchHrEnabled: false,
    watchHasFreshSample: false,
    watchAvailable: false,
    watchAvailability: 'unavailable' as const,
    hrConnected: false,
    savedHrName: null,
    sessionHeartRate: null,
  };

  it('(1) fresh Watch sample — Apple Watch · Connected', () => {
    expect(resolveHrSourceSummary({ ...base, watchHrEnabled: true, watchHasFreshSample: true })).toEqual({
      name: 'Apple Watch',
      state: 'Connected',
    });
  });

  it('fresh Watch outranks a live bike pulse', () => {
    expect(
      resolveHrSourceSummary({ ...base, watchHrEnabled: true, watchHasFreshSample: true, sessionHeartRate: 131 }),
    ).toEqual({ name: 'Apple Watch', state: 'Connected' });
  });

  it('(2) connected BLE strap — saved name + Connected', () => {
    expect(resolveHrSourceSummary({ ...base, hrConnected: true, savedHrName: 'Polar H10' })).toEqual({
      name: 'Polar H10',
      state: 'Connected',
    });
  });

  it('(2b) connected BLE with null name — Bluetooth HR', () => {
    expect(resolveHrSourceSummary({ ...base, hrConnected: true })).toEqual({
      name: 'Bluetooth HR',
      state: 'Connected',
    });
  });

  it('connected BLE outranks a live bike pulse', () => {
    expect(
      resolveHrSourceSummary({ ...base, hrConnected: true, savedHrName: 'Polar H10', sessionHeartRate: 131 }),
    ).toEqual({ name: 'Polar H10', state: 'Connected' });
  });

  it('(3) live session HR with no Watch/BLE — Bike pulse · Connected', () => {
    expect(resolveHrSourceSummary({ ...base, sessionHeartRate: 131 })).toEqual({
      name: 'Bike pulse',
      state: 'Connected',
    });
  });

  it('(4) available Watch outranks a saved-but-disconnected strap', () => {
    expect(
      resolveHrSourceSummary({
        ...base,
        watchHrEnabled: true,
        watchAvailable: true,
        watchAvailability: 'idle',
        savedHrName: 'Polar H10',
      }),
    ).toEqual({ name: 'Apple Watch', state: 'Idle' });
  });

  it('(4b) enabled+available Watch, availability unavailable — Apple Watch · Unavailable', () => {
    expect(
      resolveHrSourceSummary({ ...base, watchHrEnabled: true, watchAvailable: true, watchAvailability: 'unavailable' }),
    ).toEqual({ name: 'Apple Watch', state: 'Unavailable' });
  });

  it('(5) saved BLE not connected, no available Watch — Disconnected', () => {
    expect(resolveHrSourceSummary({ ...base, savedHrName: 'Polar H10' })).toEqual({
      name: 'Polar H10',
      state: 'Disconnected',
    });
  });

  it('(6) nothing — No HR source, null state', () => {
    expect(resolveHrSourceSummary(base)).toEqual({ name: 'No HR source', state: null });
  });
});
