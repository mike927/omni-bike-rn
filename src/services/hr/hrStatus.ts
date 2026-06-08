import type { HrSource, HrReading } from './hrSource';
import type { WatchAvailability } from '../../types/watch';
import type { DeviceStatus } from '../../types/deviceStatus';
import { TrainingPhase } from '../../types/training';

/**
 * Startup window before a never-yet-connected in-workout source flips from
 * Connecting… to No signal. Covers Apple Watch wake (startWatchApp → handle →
 * HealthKit auth → first sample), which can take ~10–20 s.
 */
export const HR_CONNECTING_GRACE_SECONDS = 30;

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
   * Current HR reading from `resolveHrReading`. Used for in-workout state machine.
   * Ignored in idle mode.
   */
  readonly reading: HrReading;
  /**
   * The effective primary source for idle display, or null when no HR source is
   * available (no watch, no saved strap). Callers resolve this via
   * `resolveEffectiveHrSource` / `resolveEffectivePrimary`.
   */
  readonly primaryHrSource: HrSource | null;
  readonly watchAvailability: WatchAvailability;
  readonly savedHrName: string | null;
  /** Whether a Bluetooth HR strap is currently connected. Used for idle BLE readiness. */
  readonly hrConnected: boolean;
  /** Current training phase. Drives the in-workout state machine (paused / ready / connecting / noSignal). */
  readonly phase: TrainingPhase;
  /** Elapsed seconds in the current session. Used for the connecting-grace window. */
  readonly elapsedSeconds: number;
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
  }
}

/**
 * Read-only summary for the Training dashboard HR tile.
 *
 * In-workout (`activeHrSource` is set): always displays the locked source.
 * State machine:
 *   - `paused`     if phase === Paused
 *   - `ready`      else if reading.live
 *   - `connecting` else if reading.awaitingFirstReading && elapsedSeconds <= HR_CONNECTING_GRACE_SECONDS
 *   - `noSignal`   otherwise
 * Never falls back to a different source.
 *
 * Idle (`activeHrSource` is null): displays the effective primary source's
 * readiness status, or "Heart rate · Not set up" when no source is available.
 */
export function resolveHrSourceSummary({
  activeHrSource,
  reading,
  primaryHrSource,
  watchAvailability,
  savedHrName,
  hrConnected,
  phase,
  elapsedSeconds,
}: HrSourceSummaryInput): HrSourceSummary {
  // ── In-workout: locked source wins unconditionally ──────────────────────
  if (activeHrSource !== null) {
    let status: DeviceStatus;
    if (phase === TrainingPhase.Paused) {
      status = 'paused';
    } else if (reading.live) {
      status = 'ready';
    } else if (reading.awaitingFirstReading && elapsedSeconds <= HR_CONNECTING_GRACE_SECONDS) {
      status = 'connecting';
    } else {
      status = 'noSignal';
    }
    return { name: hrSourceName(activeHrSource, savedHrName), status };
  }

  // ── Idle, no source available: nothing to select ────────────────────────
  if (primaryHrSource === null) {
    return { name: 'Heart rate', status: 'notSetUp' };
  }

  // ── Idle: show primary source's readiness ────────────────────────────────
  return {
    name: hrSourceName(primaryHrSource, savedHrName),
    status: hrSourceIdleReadiness({ source: primaryHrSource, watchAvailability, hrConnected }),
  };
}
