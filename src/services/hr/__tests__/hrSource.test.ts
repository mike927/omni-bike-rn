import { availableHrSources, resolveDefaultPrimary, resolveHrReading, HR_NO_SIGNAL_TIMEOUT_MS } from '../hrSource';

describe('availableHrSources', () => {
  it('offers watch only when supported, strap only when saved, bike always', () => {
    expect(availableHrSources({ watchSupported: true, savedHrStrapName: 'Polar H10' })).toEqual([
      'watch',
      'bluetooth',
      'bike',
    ]);
    expect(availableHrSources({ watchSupported: false, savedHrStrapName: null })).toEqual(['bike']);
    expect(availableHrSources({ watchSupported: false, savedHrStrapName: 'Polar H10' })).toEqual(['bluetooth', 'bike']);
  });
});

describe('resolveDefaultPrimary', () => {
  it('picks highest available: watch > bluetooth > bike', () => {
    expect(resolveDefaultPrimary(['watch', 'bluetooth', 'bike'])).toBe('watch');
    expect(resolveDefaultPrimary(['bluetooth', 'bike'])).toBe('bluetooth');
    expect(resolveDefaultPrimary(['bike'])).toBe('bike');
  });
});

const base = {
  latestAppleWatchHr: null,
  lastAppleWatchSampleAtMs: null,
  latestBluetoothHr: null,
  lastBluetoothHrSampleAtMs: null,
  bikeHeartRate: null,
  nowMs: 100_000,
} as const;

it('reads ONLY the active source — watch fresh', () => {
  expect(
    resolveHrReading({
      ...base,
      activeSource: 'watch',
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: 100_000,
      latestBluetoothHr: 99,
      bikeHeartRate: 80,
    }),
  ).toEqual({ source: 'watch', bpm: 150, live: true });
});

it('never falls back to another device — watch stale => no signal even if bike has HR', () => {
  expect(
    resolveHrReading({
      ...base,
      activeSource: 'watch',
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: 100_000 - HR_NO_SIGNAL_TIMEOUT_MS - 1,
      bikeHeartRate: 80,
    }),
  ).toEqual({ source: 'watch', bpm: null, live: false });
});

it('holds the value within the no-signal window (normal sampling gap)', () => {
  expect(
    resolveHrReading({
      ...base,
      activeSource: 'watch',
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: 100_000 - HR_NO_SIGNAL_TIMEOUT_MS + 1,
    }).bpm,
  ).toBe(150);
});

it('bluetooth uses its own freshness', () => {
  expect(
    resolveHrReading({ ...base, activeSource: 'bluetooth', latestBluetoothHr: 140, lastBluetoothHrSampleAtMs: 100_000 })
      .bpm,
  ).toBe(140);
  expect(
    resolveHrReading({
      ...base,
      activeSource: 'bluetooth',
      latestBluetoothHr: 140,
      lastBluetoothHrSampleAtMs: 100_000 - HR_NO_SIGNAL_TIMEOUT_MS - 1,
    }).bpm,
  ).toBeNull();
});

it('bike reads heartRate directly (FTMS is live while connected)', () => {
  expect(resolveHrReading({ ...base, activeSource: 'bike', bikeHeartRate: 88 })).toEqual({
    source: 'bike',
    bpm: 88,
    live: true,
  });
  expect(resolveHrReading({ ...base, activeSource: 'bike', bikeHeartRate: null }).bpm).toBeNull();
});
