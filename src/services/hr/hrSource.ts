export type HrSource = 'watch' | 'bluetooth';

const HR_SOURCES: readonly HrSource[] = ['watch', 'bluetooth'];

/** Runtime guard — true only for current `HrSource` members. Backs persistence sanitization. */
export function isHrSource(value: unknown): value is HrSource {
  return typeof value === 'string' && (HR_SOURCES as readonly string[]).includes(value);
}

export interface HrSourceAvailabilityInput {
  readonly watchSupported: boolean;
  readonly savedHrStrapName: string | null;
}

const PRIORITY: readonly HrSource[] = ['watch', 'bluetooth'];

/**
 * The HR sources the user can choose from right now. Unlike the bike trainer,
 * neither source is guaranteed: an iPhone-only user with no chest strap has
 * none, so this can legitimately be empty.
 */
export function availableHrSources({ watchSupported, savedHrStrapName }: HrSourceAvailabilityInput): HrSource[] {
  const out: HrSource[] = [];
  if (watchSupported) out.push('watch');
  if (savedHrStrapName !== null) out.push('bluetooth');
  return out;
}

/** Highest-priority available source, or null when none is available. */
export function resolveDefaultPrimary(available: HrSource[]): HrSource | null {
  return PRIORITY.find((s) => available.includes(s)) ?? null;
}

/**
 * Whether a persisted primary preference still points at a real candidate.
 *
 * Only `bluetooth` can become stale: forgetting the saved strap removes its
 * backing device, so a leftover `bluetooth` primary must be ignored (finding #3).
 * `watch` stays a candidate on its platform even when transiently unavailable
 * (backgrounded), so an explicit watch choice is never discarded here.
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
 * availability-ranked default (watch → bluetooth). Null when no source is
 * available at all (no watch, no saved strap).
 *
 * Distinct from {@link resolveEffectiveHrSource}, which additionally honors the
 * per-session lock. Settings selection, the Home HR card, and `useWatchHr` use
 * this so they agree with what the engine resolves.
 */
export function resolveEffectivePrimary({
  primaryHrSource,
  watchSupported,
  savedHrStrapName,
}: ResolveEffectivePrimaryInput): HrSource | null {
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
 * Priority: session-locked source → user-configured primary → availability
 * default. A stale primary (e.g. `bluetooth` after the strap is forgotten) falls
 * through to the default — see {@link resolveEffectivePrimary}. Null when there
 * is no available source.
 */
export function resolveEffectiveHrSource({
  activeHrSource,
  primaryHrSource,
  watchSupported,
  savedHrStrapName,
}: ResolveEffectiveHrSourceInput): HrSource | null {
  return activeHrSource ?? resolveEffectivePrimary({ primaryHrSource, watchSupported, savedHrStrapName });
}

// Sustained loss before "No signal". Set above the slowest source cadence (Apple
// Watch wrist HR delivers ~every 6 s with occasional longer gaps) so a normal gap
// does not blank the value; only a real loss does.
export const HR_NO_SIGNAL_TIMEOUT_MS = 15_000;

export interface HrReadingInput {
  /** The locked/effective source, or null when no HR source is available. */
  readonly activeSource: HrSource | null;
  readonly latestAppleWatchHr: number | null;
  readonly lastAppleWatchSampleAtMs: number | null;
  readonly latestBluetoothHr: number | null;
  readonly lastBluetoothHrSampleAtMs: number | null;
  readonly nowMs: number;
}
export interface HrReading {
  readonly source: HrSource | null;
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
    case null:
      // No HR source available — no signal, still awaiting first data.
      bpm = null;
      received = false;
      break;
  }
  return { source: input.activeSource, bpm, live: bpm !== null, awaitingFirstReading: !received };
}
