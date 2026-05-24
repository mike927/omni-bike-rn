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
  readonly watchHrEnabled: boolean;
  readonly watchHasFreshSample: boolean;
  readonly watchAvailable: boolean;
  readonly watchAvailability: WatchAvailability;
  readonly hrConnected: boolean;
  readonly savedHrName: string | null;
  readonly sessionHeartRate: number | null;
}

export interface HrSourceSummary {
  readonly name: string;
  readonly state: string | null;
}

/**
 * Read-only summary for the Training dashboard HR tile: which HR device/source
 * to display and its connection state, mirroring MetronomeEngine's priority
 * (Watch > Bluetooth HR > bike pulse).
 *
 * Streaming sources rank first: a fresh Watch sample, then a connected Bluetooth
 * strap, then live bike pulse (a session HR with no Watch/Bluetooth attribution).
 * Watch counts as fresh only when staleness-gated by the caller, so a stale Watch
 * falls through rather than claiming a connection it isn't providing. When nothing
 * is streaming, an available (idle) Watch outranks a saved-but-disconnected strap —
 * keeping Watch > Bluetooth on the idle surface too.
 */
export function resolveHrSourceSummary({
  watchHrEnabled,
  watchHasFreshSample,
  watchAvailable,
  watchAvailability,
  hrConnected,
  savedHrName,
  sessionHeartRate,
}: HrSourceSummaryInput): HrSourceSummary {
  // Streaming sources first, in engine priority order (Watch > Bluetooth > bike).
  if (watchHrEnabled && watchHasFreshSample) {
    return { name: 'Apple Watch', state: 'Connected' };
  }
  if (hrConnected) {
    return { name: savedHrName ?? 'Bluetooth HR', state: 'Connected' };
  }
  if (sessionHeartRate !== null) {
    // Live session HR with no fresh Watch and no connected strap = bike pulse.
    return { name: 'Bike pulse', state: 'Connected' };
  }
  // Nothing streaming: an available Watch outranks a saved-but-disconnected strap.
  if (watchHrEnabled && watchAvailable) {
    return {
      name: 'Apple Watch',
      state: watchHrDisplayLabel(resolveWatchHrDisplayState(watchHrEnabled, watchAvailability)),
    };
  }
  if (savedHrName !== null) {
    return { name: savedHrName, state: 'Disconnected' };
  }
  return { name: 'No HR source', state: null };
}
