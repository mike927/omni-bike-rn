import type { WatchAvailability } from '../../types/watch';

export type ActiveHrSource = 'watch' | 'bluetooth' | 'bike' | 'none';

export interface ActiveHrSourceInput {
  readonly watchHrEnabled: boolean;
  readonly latestAppleWatchHr: number | null;
  readonly latestBluetoothHr: number | null;
  readonly sessionHeartRate: number | null;
}

/**
 * Display-side mirror of MetronomeEngine's HR priority (Watch > Bluetooth HR >
 * bike pulse). Watch only counts when the user has Watch HR enabled; a session
 * HR with no Watch/Bluetooth value is attributed to the bike's pulse sensor.
 */
export function resolveActiveHrSource({
  watchHrEnabled,
  latestAppleWatchHr,
  latestBluetoothHr,
  sessionHeartRate,
}: ActiveHrSourceInput): ActiveHrSource {
  if (watchHrEnabled && latestAppleWatchHr !== null) return 'watch';
  if (latestBluetoothHr !== null) return 'bluetooth';
  if (sessionHeartRate !== null) return 'bike';
  return 'none';
}

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

const ACTIVE_HR_SOURCE_LABELS: Record<ActiveHrSource, string> = {
  watch: 'Apple Watch',
  bluetooth: 'Bluetooth HR',
  bike: 'Bike pulse',
  none: 'No HR source',
};

export function activeHrSourceLabel(source: ActiveHrSource): string {
  return ACTIVE_HR_SOURCE_LABELS[source];
}

const WATCH_HR_DISPLAY_LABELS: Record<WatchHrDisplayState, string> = {
  disabled: 'Disabled',
  unavailable: 'Unavailable',
  idle: 'Idle',
  in_progress: 'In Progress',
};

export function watchHrDisplayLabel(state: WatchHrDisplayState): string {
  return WATCH_HR_DISPLAY_LABELS[state];
}

export const WATCH_HR_UNAVAILABLE_HINT =
  'Open the Omni Bike app on your Apple Watch. If it is not installed yet, add it from the iPhone Watch app.';
