import {
  WATCH_HR_UNAVAILABLE_HINT,
  activeHrSourceLabel,
  resolveActiveHrSource,
  resolveWatchHrDisplayState,
  watchHrDisplayLabel,
} from '../hrStatus';

describe('resolveActiveHrSource', () => {
  it('reports watch when Watch HR is enabled and streaming', () => {
    expect(
      resolveActiveHrSource({
        watchHrEnabled: true,
        latestAppleWatchHr: 148,
        latestBluetoothHr: 142,
        sessionHeartRate: 148,
      }),
    ).toBe('watch');
  });

  it('ignores a Watch value when Watch HR is disabled, falling to Bluetooth', () => {
    expect(
      resolveActiveHrSource({
        watchHrEnabled: false,
        latestAppleWatchHr: 148,
        latestBluetoothHr: 142,
        sessionHeartRate: 142,
      }),
    ).toBe('bluetooth');
  });

  it('reports bluetooth when only a Bluetooth HR value is present', () => {
    expect(
      resolveActiveHrSource({
        watchHrEnabled: true,
        latestAppleWatchHr: null,
        latestBluetoothHr: 140,
        sessionHeartRate: 140,
      }),
    ).toBe('bluetooth');
  });

  it('attributes a session HR with no Watch/Bluetooth value to the bike pulse', () => {
    expect(
      resolveActiveHrSource({
        watchHrEnabled: true,
        latestAppleWatchHr: null,
        latestBluetoothHr: null,
        sessionHeartRate: 131,
      }),
    ).toBe('bike');
  });

  it('reports none when no HR is available anywhere', () => {
    expect(
      resolveActiveHrSource({
        watchHrEnabled: true,
        latestAppleWatchHr: null,
        latestBluetoothHr: null,
        sessionHeartRate: null,
      }),
    ).toBe('none');
  });
});

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
  it('maps active HR sources to human labels', () => {
    expect(activeHrSourceLabel('watch')).toBe('Apple Watch');
    expect(activeHrSourceLabel('bluetooth')).toBe('Bluetooth HR');
    expect(activeHrSourceLabel('bike')).toBe('Bike pulse');
    expect(activeHrSourceLabel('none')).toBe('No HR source');
  });

  it('maps Watch HR display states to human labels', () => {
    expect(watchHrDisplayLabel('disabled')).toBe('Disabled');
    expect(watchHrDisplayLabel('unavailable')).toBe('Unavailable');
    expect(watchHrDisplayLabel('idle')).toBe('Idle');
    expect(watchHrDisplayLabel('in_progress')).toBe('In Progress');
  });

  it('exposes the canonical Watch-unavailable hint copy', () => {
    expect(WATCH_HR_UNAVAILABLE_HINT).toBe(
      'Open the Omni Bike app on your Apple Watch. If it is not installed yet, add it from the iPhone Watch app.',
    );
  });
});
