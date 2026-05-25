import type { HrSource, HrReading } from './hrSource';
import type { WatchAvailability } from '../../types/watch';

export type WatchHrDisplayState = 'disabled' | WatchAvailability;

/**
 * Collapses to `disabled` when the user has turned Watch HR off so every screen
 * reports the same state Settings does, instead of a misleading `idle`.
 */
export function resolveWatchHrDisplayState(
  watchHrEnabled: boolean,
  watchAvailability: WatchAvailability,
): WatchHrDisplayState {
  return watchHrEnabled ? watchAvailability : 'disabled';
}

const WATCH_HR_DISPLAY_LABELS: Record<WatchHrDisplayState, string> = {
  disabled: 'Disabled',
  unavailable: 'Unavailable',
  idle: 'Idle',
  in_progress: 'Connected',
};

export function watchHrDisplayLabel(state: WatchHrDisplayState): string {
  return WATCH_HR_DISPLAY_LABELS[state];
}

export const WATCH_HR_UNAVAILABLE_HINT =
  'Open the Omni Bike app on your Apple Watch. If it is not installed yet, add it from the iPhone Watch app.';

export interface HrSourceSummaryInput {
  /** The per-session locked HR source. Null = pre-workout (idle). */
  readonly activeHrSource: HrSource | null;
  /**
   * Current HR reading from `resolveHrReading`. Used for in-workout Connected/No signal.
   * Ignored in idle mode.
   */
  readonly reading: HrReading;
  /**
   * The effective primary source for idle display. Always non-null — callers must
   * resolve a default before calling (e.g. via `resolveEffectiveHrSource`).
   */
  readonly primaryHrSource: HrSource;
  readonly watchAvailability: WatchAvailability;
  readonly savedHrName: string | null;
  /** Whether a Bluetooth HR strap is currently connected. Used for idle BLE readiness. */
  readonly hrConnected: boolean;
}

export interface HrSourceSummary {
  readonly name: string;
  readonly state: string | null;
}

/** Human-readable name for an HR source. */
export function hrSourceName(source: HrSource, savedHrName: string | null): string {
  switch (source) {
    case 'watch':
      return 'Apple Watch';
    case 'bluetooth':
      return savedHrName ?? 'Bluetooth HR';
    case 'bike':
      return 'Bike pulse';
  }
}

export interface HrSourceIdleReadinessInput {
  readonly source: HrSource;
  readonly watchAvailability: WatchAvailability;
  readonly hrConnected: boolean;
}

/** Readiness label for a source when no workout is active (idle). */
export function hrSourceIdleReadiness({ source, watchAvailability, hrConnected }: HrSourceIdleReadinessInput): string {
  switch (source) {
    case 'watch':
      return WATCH_HR_DISPLAY_LABELS[watchAvailability];
    case 'bluetooth':
      return hrConnected ? 'Connected' : 'Disconnected';
    case 'bike':
      return 'Connected';
  }
}

/**
 * Read-only summary for the Training dashboard HR tile.
 *
 * In-workout (`activeHrSource` is set): always displays the locked source with
 * `Connected` when the reading is live, `No signal` otherwise. Never falls back
 * to a different source.
 *
 * Idle (`activeHrSource` is null): displays the effective primary source's
 * readiness label (e.g. `Idle`, `Disconnected`, `Connected`).
 */
export function resolveHrSourceSummary({
  activeHrSource,
  reading,
  primaryHrSource,
  watchAvailability,
  savedHrName,
  hrConnected,
}: HrSourceSummaryInput): HrSourceSummary {
  // ── In-workout: locked source wins unconditionally ──────────────────────
  if (activeHrSource !== null) {
    return {
      name: hrSourceName(activeHrSource, savedHrName),
      state: reading.live ? 'Connected' : 'No signal',
    };
  }

  // ── Idle: show primary source's readiness ────────────────────────────────
  return {
    name: hrSourceName(primaryHrSource, savedHrName),
    state: hrSourceIdleReadiness({ source: primaryHrSource, watchAvailability, hrConnected }),
  };
}
