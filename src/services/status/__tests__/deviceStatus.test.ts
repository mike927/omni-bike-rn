import { deviceStatusLabel, type DeviceStatus } from '../deviceStatus';

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
