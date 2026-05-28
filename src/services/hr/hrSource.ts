export type HrSource = 'watch' | 'bluetooth' | 'bike';

export interface HrSourceAvailabilityInput {
  readonly watchSupported: boolean;
  readonly savedHrStrapName: string | null;
}

const PRIORITY: readonly HrSource[] = ['watch', 'bluetooth', 'bike'];

export function availableHrSources({ watchSupported, savedHrStrapName }: HrSourceAvailabilityInput): HrSource[] {
  const out: HrSource[] = [];
  if (watchSupported) out.push('watch');
  if (savedHrStrapName !== null) out.push('bluetooth');
  out.push('bike'); // the bike's built-in pulse sensor is always a candidate
  return out;
}

export function resolveDefaultPrimary(available: HrSource[]): HrSource {
  return PRIORITY.find((s) => available.includes(s)) ?? 'bike';
}

/**
 * Whether a persisted primary preference still points at a real candidate.
 *
 * Only `bluetooth` can become stale: forgetting the saved strap removes its
 * backing device, so a leftover `bluetooth` primary must be ignored (finding #3).
 * `watch` stays a candidate on its platform even when transiently unavailable
 * (backgrounded), so an explicit watch choice is never discarded here; `bike`
 * is always present.
 */
function isPrimaryStillValid(primary: HrSource, savedHrStrapName: string | null): boolean {
  if (primary === 'bluetooth') return savedHrStrapName !== null;
  return true;
}

export interface ResolveEffectivePrimaryInput extends HrSourceAvailabilityInput {
  readonly primaryHrSource: HrSource | null;
}

/**
 * The effective *primary* HR source for display and the Watch lifecycle: the
 * user's explicit choice when it is still a valid candidate, otherwise the
 * availability-ranked default (watch → bluetooth → bike). Always non-null.
 *
 * Distinct from {@link resolveEffectiveHrSource}, which additionally honors the
 * per-session lock. Settings selection, the Home HR card, and `useWatchHr` use
 * this so they agree with what the engine resolves.
 */
export function resolveEffectivePrimary({
  primaryHrSource,
  watchSupported,
  savedHrStrapName,
}: ResolveEffectivePrimaryInput): HrSource {
  if (primaryHrSource !== null && isPrimaryStillValid(primaryHrSource, savedHrStrapName)) {
    return primaryHrSource;
  }
  return resolveDefaultPrimary(availableHrSources({ watchSupported, savedHrStrapName }));
}

export interface ResolveEffectiveHrSourceInput extends HrSourceAvailabilityInput {
  readonly activeHrSource: HrSource | null;
  readonly primaryHrSource: HrSource | null;
}

/**
 * Single source of truth for the effective HR source used by both the
 * dashboard and the MetronomeEngine.
 *
 * Priority: session-locked source → user-configured primary → hardware default.
 * A stale primary (e.g. `bluetooth` after the strap is forgotten) falls through
 * to the default — see {@link resolveEffectivePrimary}.
 */
export function resolveEffectiveHrSource({
  activeHrSource,
  primaryHrSource,
  watchSupported,
  savedHrStrapName,
}: ResolveEffectiveHrSourceInput): HrSource {
  return activeHrSource ?? resolveEffectivePrimary({ primaryHrSource, watchSupported, savedHrStrapName });
}

// Sustained loss before "No signal". Set above the slowest source cadence (Apple
// Watch wrist HR delivers ~every 6 s with occasional longer gaps) so a normal gap
// does not blank the value; only a real loss does.
export const HR_NO_SIGNAL_TIMEOUT_MS = 15_000;

export interface HrReadingInput {
  readonly activeSource: HrSource;
  readonly latestAppleWatchHr: number | null;
  readonly lastAppleWatchSampleAtMs: number | null;
  readonly latestBluetoothHr: number | null;
  readonly lastBluetoothHrSampleAtMs: number | null;
  readonly bikeHeartRate: number | null;
  readonly nowMs: number;
}
export interface HrReading {
  readonly source: HrSource;
  readonly bpm: number | null; // null = no signal
  readonly live: boolean;
  /**
   * true when no sample has been received yet this session for this source
   * (distinguishes a still-connecting startup from a had-it-then-lost-it gap).
   */
  readonly awaitingFirstReading: boolean;
}

function fresh(value: number | null, atMs: number | null, nowMs: number): number | null {
  if (value === null || atMs === null) return null;
  return nowMs - atMs <= HR_NO_SIGNAL_TIMEOUT_MS ? value : null;
}

export function resolveHrReading(input: HrReadingInput): HrReading {
  let bpm: number | null;
  let received: boolean;
  switch (input.activeSource) {
    case 'watch':
      bpm = fresh(input.latestAppleWatchHr, input.lastAppleWatchSampleAtMs, input.nowMs);
      received = input.lastAppleWatchSampleAtMs !== null;
      break;
    case 'bluetooth':
      bpm = fresh(input.latestBluetoothHr, input.lastBluetoothHrSampleAtMs, input.nowMs);
      received = input.lastBluetoothHrSampleAtMs !== null;
      break;
    case 'bike':
      bpm = input.bikeHeartRate; // FTMS pushes ~1 Hz while connected; absence = no signal
      received = input.bikeHeartRate !== null;
      break;
  }
  return { source: input.activeSource, bpm, live: bpm !== null, awaitingFirstReading: !received };
}
