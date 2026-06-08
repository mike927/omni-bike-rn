import {
  availableHrSources,
  resolveDefaultPrimary,
  resolveEffectivePrimary,
  resolveEffectiveHrSource,
  resolveHrReading,
  isHrSource,
  HR_NO_SIGNAL_TIMEOUT_MS,
} from '../hrSource';

describe('availableHrSources', () => {
  it('offers watch only when supported and strap only when saved', () => {
    expect(
      availableHrSources({
        watchSupported: true,
        savedHrStrapName: 'Polar H10',
      }),
    ).toEqual(['watch', 'bluetooth']);
    expect(availableHrSources({ watchSupported: true, savedHrStrapName: null })).toEqual(['watch']);
    expect(
      availableHrSources({
        watchSupported: false,
        savedHrStrapName: 'Polar H10',
      }),
    ).toEqual(['bluetooth']);
  });

  it('offers NO source when neither watch nor strap is available', () => {
    expect(availableHrSources({ watchSupported: false, savedHrStrapName: null })).toEqual([]);
  });
});

describe('resolveDefaultPrimary', () => {
  it('picks highest available: watch > bluetooth', () => {
    expect(resolveDefaultPrimary(['watch', 'bluetooth'])).toBe('watch');
    expect(resolveDefaultPrimary(['bluetooth'])).toBe('bluetooth');
    expect(resolveDefaultPrimary(['watch'])).toBe('watch');
  });

  it('returns null when no source is available', () => {
    expect(resolveDefaultPrimary([])).toBeNull();
  });
});

describe('resolveEffectivePrimary', () => {
  it('returns an explicit primary when it is still a valid candidate', () => {
    expect(
      resolveEffectivePrimary({ primaryHrSource: 'bluetooth', watchSupported: true, savedHrStrapName: 'Polar H10' }),
    ).toBe('bluetooth');
  });

  it('keeps an explicit watch primary through transient unavailability', () => {
    // The Watch is iOS-only but always a candidate there; a momentary
    // unavailable (backgrounded) must NOT discard an explicit watch choice.
    expect(resolveEffectivePrimary({ primaryHrSource: 'watch', watchSupported: false, savedHrStrapName: null })).toBe(
      'watch',
    );
  });

  it('falls through to the default when a bluetooth primary has no saved strap', () => {
    // Finding #3: forgetting the strap must not leave a stale bluetooth primary.
    expect(
      resolveEffectivePrimary({ primaryHrSource: 'bluetooth', watchSupported: true, savedHrStrapName: null }),
    ).toBe('watch');
  });

  it('resolves the availability-ranked default when no primary is set', () => {
    expect(
      resolveEffectivePrimary({ primaryHrSource: null, watchSupported: true, savedHrStrapName: 'Polar H10' }),
    ).toBe('watch');
    expect(
      resolveEffectivePrimary({ primaryHrSource: null, watchSupported: false, savedHrStrapName: 'Polar H10' }),
    ).toBe('bluetooth');
  });

  it('returns null when no primary is set and no source is available', () => {
    expect(
      resolveEffectivePrimary({ primaryHrSource: null, watchSupported: false, savedHrStrapName: null }),
    ).toBeNull();
  });

  it('returns null when a stale bluetooth primary has no fallback source', () => {
    // strap forgotten + no watch → nothing left to fall back to.
    expect(
      resolveEffectivePrimary({ primaryHrSource: 'bluetooth', watchSupported: false, savedHrStrapName: null }),
    ).toBeNull();
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

  it('ignores a stale bluetooth primary once the strap is forgotten', () => {
    // Finding #3: no saved strap → bluetooth is no longer a candidate, so the
    // engine must re-resolve to the default rather than keep selecting bluetooth.
    expect(
      resolveEffectiveHrSource({
        watchSupported: true,
        savedHrStrapName: null,
        activeHrSource: null,
        primaryHrSource: 'bluetooth',
      }),
    ).toBe('watch');
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

  it('returns null when active and primary are null and no source is available', () => {
    expect(
      resolveEffectiveHrSource({
        ...base,
        activeHrSource: null,
        primaryHrSource: null,
      }),
    ).toBeNull();
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

describe('isHrSource', () => {
  it('accepts current members and rejects everything else', () => {
    expect(isHrSource('watch')).toBe(true);
    expect(isHrSource('bluetooth')).toBe(true);
    // legacy / removed value
    expect(isHrSource('bike')).toBe(false);
    expect(isHrSource(null)).toBe(false);
    expect(isHrSource(undefined)).toBe(false);
    expect(isHrSource('nonsense')).toBe(false);
  });
});

const base = {
  latestAppleWatchHr: null,
  lastAppleWatchSampleAtMs: null,
  latestBluetoothHr: null,
  lastBluetoothHrSampleAtMs: null,
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
    }),
  ).toEqual({ source: 'watch', bpm: 150, live: true, awaitingFirstReading: false });
});

it('never falls back to another device — watch stale => no signal', () => {
  expect(
    resolveHrReading({
      ...base,
      activeSource: 'watch',
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: 100_000 - HR_NO_SIGNAL_TIMEOUT_MS - 1,
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

it('a null active source yields a no-signal reading awaiting first data', () => {
  expect(
    resolveHrReading({
      ...base,
      activeSource: null,
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: 100_000,
      latestBluetoothHr: 140,
      lastBluetoothHrSampleAtMs: 100_000,
    }),
  ).toEqual({ source: null, bpm: null, live: false, awaitingFirstReading: true });
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
});
