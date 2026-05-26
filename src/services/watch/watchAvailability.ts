import type { WatchAvailability } from '../../types/watch';

/** No-contact window before the Watch reads `unavailable` while idle. Rides out a
 *  wrist-down / screen-dim blip without flapping. */
export const WATCH_IDLE_GRACE_MS = 10_000;
/** Wider window during an active workout: rides out background HR-delivery gaps; a
 *  watch killed mid-ride (no clean session end) flips to `unavailable` after this. */
export const WATCH_WORKOUT_GRACE_MS = 30_000;

export interface WatchContactInput {
  readonly isReachable: boolean;
  readonly workoutActive: boolean;
  readonly lastContactAtMs: number | null;
  readonly nowMs: number;
}

/** Two-state, contact-based availability. `workoutActive` only widens the grace — it
 *  does not by itself force `connected`, so a killed mid-ride watch still expires. */
export function resolveWatchAvailability(input: WatchContactInput): WatchAvailability {
  if (input.isReachable) return 'connected';
  const grace = input.workoutActive ? WATCH_WORKOUT_GRACE_MS : WATCH_IDLE_GRACE_MS;
  if (input.lastContactAtMs !== null && input.nowMs - input.lastContactAtMs <= grace) {
    return 'connected';
  }
  return 'unavailable';
}
