import {
  availableHrSources,
  resolveDefaultPrimary,
  resolveEffectiveHrSource,
  resolveHrReading,
  HR_NO_SIGNAL_TIMEOUT_MS,
} from '../hrSource';

describe('availableHrSources', () => {
  it('offers watch only when supported, strap only when saved, bike always', () => {
    expect(
      availableHrSources({
        watchSupported: true,
        savedHrStrapName: 'Polar H10',
      }),
    ).toEqual(['watch', 'bluetooth', 'bike']);
    expect(availableHrSources({ watchSupported: false, savedHrStrapName: null })).toEqual(['bike']);
    expect(
      availableHrSources({
        watchSupported: false,
        savedHrStrapName: 'Polar H10',
      }),
    ).toEqual(['bluetooth', 'bike']);
  });
});

describe('resolveDefaultPrimary', () => {
  it('picks highest available: watch > bluetooth > bike', () => {
    expect(resolveDefaultPrimary(['watch', 'bluetooth', 'bike'])).toBe('watch');
    expect(resolveDefaultPrimary(['bluetooth', 'bike'])).toBe('bluetooth');
    expect(resolveDefaultPrimary(['bike'])).toBe('bike');
  });
});

describe('resolveEffectiveHrSource', () => {
  const base = { watchSupported: false, savedHrStrapName: null };

  it('activeHrSource wins when set', () => {
    expect(
      resolveEffectiveHrSource({
        ...base,
        activeHrSource: 'bluetooth',
        primaryHrSource: 'watch',
      }),
    ).toBe('bluetooth');
  });

  it('primaryHrSource is used when activeHrSource is null', () => {
    expect(
      resolveEffectiveHrSource({
        ...base,
        activeHrSource: null,
        primaryHrSource: 'watch',
      }),
    ).toBe('watch');
  });

  it('falls back to default resolution when both active and primary are null', () => {
    // No watch, no strap → default is 'bike'
    expect(
      resolveEffectiveHrSource({
        ...base,
        activeHrSource: null,
        primaryHrSource: null,
      }),
    ).toBe('bike');
  });

  it('default resolution respects watchSupported when primary is null', () => {
    expect(
      resolveEffectiveHrSource({
        watchSupported: true,
        savedHrStrapName: null,
        activeHrSource: null,
        primaryHrSource: null,
      }),
    ).toBe('watch');
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
  ).toEqual({ source: 'watch', bpm: 150, live: true, awaitingFirstReading: false });
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
  ).toEqual({ source: 'watch', bpm: null, live: false, awaitingFirstReading: false });
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
    resolveHrReading({
      ...base,
      activeSource: 'bluetooth',
      latestBluetoothHr: 140,
      lastBluetoothHrSampleAtMs: 100_000,
    }).bpm,
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
    awaitingFirstReading: false,
  });
  expect(resolveHrReading({ ...base, activeSource: 'bike', bikeHeartRate: null })).toEqual({
    source: 'bike',
    bpm: null,
    live: false,
    awaitingFirstReading: true,
  });
});

it('awaitingFirstReading is true when no sample has been received yet (timestamp/value null)', () => {
  // watch: no sample timestamp yet
  expect(
    resolveHrReading({ ...base, activeSource: 'watch', lastAppleWatchSampleAtMs: null }).awaitingFirstReading,
  ).toBe(true);
  // watch: sample received (timestamp non-null, even if stale)
  expect(
    resolveHrReading({
      ...base,
      activeSource: 'watch',
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: 100_000 - HR_NO_SIGNAL_TIMEOUT_MS - 1,
    }).awaitingFirstReading,
  ).toBe(false);

  // bluetooth: no sample timestamp yet
  expect(
    resolveHrReading({ ...base, activeSource: 'bluetooth', lastBluetoothHrSampleAtMs: null }).awaitingFirstReading,
  ).toBe(true);
  // bluetooth: sample received (timestamp non-null, even if stale)
  expect(
    resolveHrReading({
      ...base,
      activeSource: 'bluetooth',
      latestBluetoothHr: 140,
      lastBluetoothHrSampleAtMs: 100_000 - HR_NO_SIGNAL_TIMEOUT_MS - 1,
    }).awaitingFirstReading,
  ).toBe(false);

  // bike: no value yet
  expect(resolveHrReading({ ...base, activeSource: 'bike', bikeHeartRate: null }).awaitingFirstReading).toBe(true);
  // bike: value present
  expect(resolveHrReading({ ...base, activeSource: 'bike', bikeHeartRate: 88 }).awaitingFirstReading).toBe(false);
});
