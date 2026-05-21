/**
 * Watch stream is treated as stale — and Watch-sourced HR/kcal dropped in favour
 * of BLE/bike fallbacks — if no new Watch sample has arrived for this long.
 * Five ticks of tolerance survives brief WatchConnectivity reachability blips
 * without flapping the source mid-ride.
 *
 * Shared by {@link MetronomeEngine} (which applies it to the live HR/kcal merge)
 * and the display layer (so the surfaced "active HR source" mirrors the same
 * gate instead of trusting a retained-but-stale `latestAppleWatchHr`).
 */
export const WATCH_SAMPLE_STALE_TIMEOUT_MS = 5_000;

/** True when no fresh Watch sample has arrived inside the staleness window. */
export function isWatchSampleStale(lastAppleWatchSampleAtMs: number | null, nowMs: number): boolean {
  if (lastAppleWatchSampleAtMs === null) return true;
  return nowMs - lastAppleWatchSampleAtMs > WATCH_SAMPLE_STALE_TIMEOUT_MS;
}

/**
 * The Watch HR that should actually be used right now: the latest value while
 * its sample is fresh, otherwise `null` so callers fall through to BLE/bike.
 */
export function resolveEffectiveWatchHr(
  latestAppleWatchHr: number | null,
  lastAppleWatchSampleAtMs: number | null,
  nowMs: number,
): number | null {
  if (latestAppleWatchHr === null) return null;
  return isWatchSampleStale(lastAppleWatchSampleAtMs, nowMs) ? null : latestAppleWatchHr;
}
