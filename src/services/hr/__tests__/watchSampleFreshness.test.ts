import { WATCH_SAMPLE_STALE_TIMEOUT_MS, isWatchSampleStale, resolveEffectiveWatchHr } from '../watchSampleFreshness';

describe('isWatchSampleStale', () => {
  const now = 100_000;

  it('treats a never-sampled stream (null timestamp) as stale', () => {
    expect(isWatchSampleStale(null, now)).toBe(true);
  });

  it('is fresh while inside the staleness window', () => {
    expect(isWatchSampleStale(now - (WATCH_SAMPLE_STALE_TIMEOUT_MS - 1), now)).toBe(false);
  });

  it('is fresh exactly at the staleness boundary', () => {
    expect(isWatchSampleStale(now - WATCH_SAMPLE_STALE_TIMEOUT_MS, now)).toBe(false);
  });

  it('is stale once the window is exceeded', () => {
    expect(isWatchSampleStale(now - (WATCH_SAMPLE_STALE_TIMEOUT_MS + 1), now)).toBe(true);
  });
});

describe('resolveEffectiveWatchHr', () => {
  const now = 100_000;

  it('returns null when there is no Watch HR value', () => {
    expect(resolveEffectiveWatchHr(null, now, now)).toBeNull();
  });

  it('returns the Watch HR when the sample is fresh', () => {
    expect(resolveEffectiveWatchHr(148, now - 1_000, now)).toBe(148);
  });

  it('drops a Watch HR whose sample has gone stale', () => {
    expect(resolveEffectiveWatchHr(148, now - (WATCH_SAMPLE_STALE_TIMEOUT_MS + 1), now)).toBeNull();
  });

  it('drops a Watch HR with no sample timestamp', () => {
    expect(resolveEffectiveWatchHr(148, null, now)).toBeNull();
  });
});
