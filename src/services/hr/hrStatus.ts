import type { HrSource, HrReading } from './hrSource';
import type { WatchAvailability } from '../../types/watch';
import type { DeviceStatus } from '../status/deviceStatus';

/**
 * Watch HR status for the read-only surfaces (Home card, Training tile).
 *
 * Collapses to `off` when the Watch is not the selected primary source, so every
 * screen reports the same state Settings does instead of a misleading
 * availability label. When the Watch IS primary, maps the companion-presence
 * availability to `ready` / `unavailable`.
 */
export function watchHrStatus(watchIsPrimary: boolean, watchAvailability: WatchAvailability): DeviceStatus {
  if (!watchIsPrimary) return 'off';
  return watchAvailability === 'connected' ? 'ready' : 'unavailable';
}

export const WATCH_HR_UNAVAILABLE_HINT =
  'Open the Omni Bike app on your Apple Watch. If it is not installed yet, add it from the iPhone Watch app.';

export interface HrSourceSummaryInput {
  /** The per-session locked HR source. Null = pre-workout (idle). */
  readonly activeHrSource: HrSource | null;
  /**
   * Current HR reading from `resolveHrReading`. Used for in-workout ready/noSignal.
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
  readonly status: DeviceStatus;
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

/**
 * Readiness status for a source when no workout is active (idle). Used by the
 * Primary HR Source radio options, where each option shows its own true
 * readiness (never `off` — that collapse only applies to read-only surfaces).
 */
export function hrSourceIdleReadiness({
  source,
  watchAvailability,
  hrConnected,
}: HrSourceIdleReadinessInput): DeviceStatus {
  switch (source) {
    case 'watch':
      return watchAvailability === 'connected' ? 'ready' : 'unavailable';
    case 'bluetooth':
      return hrConnected ? 'ready' : 'unavailable';
    case 'bike':
      return 'ready';
  }
}

/**
 * Read-only summary for the Training dashboard HR tile.
 *
 * In-workout (`activeHrSource` is set): always displays the locked source with
 * `ready` when the reading is live, `noSignal` otherwise. Never falls back to a
 * different source.
 *
 * Idle (`activeHrSource` is null): displays the effective primary source's
 * readiness status.
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
      status: reading.live ? 'ready' : 'noSignal',
    };
  }

  // ── Idle: show primary source's readiness ────────────────────────────────
  return {
    name: hrSourceName(primaryHrSource, savedHrName),
    status: hrSourceIdleReadiness({ source: primaryHrSource, watchAvailability, hrConnected }),
  };
}
