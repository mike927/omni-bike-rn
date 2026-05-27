import { bleDeviceStatus, deviceStatusLabel, type DeviceStatus } from '../deviceStatus';

describe('deviceStatusLabel', () => {
  const cases: [DeviceStatus, string][] = [
    ['notSetUp', 'Not set up'],
    ['connecting', 'Connecting...'],
    ['ready', 'Ready'],
    ['noSignal', 'No signal'],
    ['unavailable', 'Unavailable'],
    ['off', 'Off'],
  ];

  it.each(cases)('maps %s → "%s"', (status, label) => {
    expect(deviceStatusLabel(status)).toBe(label);
  });
});

describe('bleDeviceStatus', () => {
  it('returns notSetUp when no device is saved, regardless of other inputs', () => {
    expect(bleDeviceStatus({ hasSavedDevice: false, connected: true, reconnect: 'connected' })).toBe('notSetUp');
    expect(bleDeviceStatus({ hasSavedDevice: false, connected: false, reconnect: 'connecting' })).toBe('notSetUp');
  });

  it('returns ready when connected (connected wins over reconnect state)', () => {
    expect(bleDeviceStatus({ hasSavedDevice: true, connected: true, reconnect: 'connecting' })).toBe('ready');
    expect(bleDeviceStatus({ hasSavedDevice: true, connected: true, reconnect: 'connected' })).toBe('ready');
  });

  it('returns connecting when not connected and an attempt is in flight', () => {
    expect(bleDeviceStatus({ hasSavedDevice: true, connected: false, reconnect: 'connecting' })).toBe('connecting');
  });

  it('collapses idle / disconnected / failed to unavailable', () => {
    expect(bleDeviceStatus({ hasSavedDevice: true, connected: false, reconnect: 'idle' })).toBe('unavailable');
    expect(bleDeviceStatus({ hasSavedDevice: true, connected: false, reconnect: 'disconnected' })).toBe('unavailable');
    expect(bleDeviceStatus({ hasSavedDevice: true, connected: false, reconnect: 'failed' })).toBe('unavailable');
  });
});
