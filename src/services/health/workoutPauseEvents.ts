import type { WorkoutEventInput } from 'apple-health-workout';

import type { SessionPauseEvent } from '../../types/sessionPersistence';

/**
 * Turn a ride's pause history into the workout events HealthKit needs.
 *
 * HealthKit is the one that decides how long a workout lasted: `HKWorkoutBuilder`
 * excludes the interval between a `pause` event and the following `resume` from
 * the elapsed time it hands to the saved `HKWorkout`. So the export does not
 * shorten the workout's window to hide a break, which would strand every sample
 * recorded after it outside the workout. It reports the real start, the real
 * end, and the breaks in between, and lets HealthKit subtract them.
 *
 * `null` events (a ride recorded before the app kept a pause history) produce no
 * workout events at all. That is deliberate: the app can tell from the elapsed
 * seconds that such a ride was paused, but nothing in the row says *when*, and
 * an invented interval would mark real effort as a break. An old ride therefore
 * keeps exporting as one continuous effort, exactly as it did before.
 */
export function toWorkoutEvents(
  pauseEvents: readonly SessionPauseEvent[] | null | undefined,
  startedAtMs: number,
  endedAtMs: number,
): WorkoutEventInput[] {
  if (!pauseEvents) {
    return [];
  }

  const withinWorkout = pauseEvents
    .filter((event) => Number.isFinite(event.atMs) && event.atMs >= startedAtMs && event.atMs <= endedAtMs)
    .slice()
    .sort((left, right) => left.atMs - right.atMs);

  const events: WorkoutEventInput[] = [];
  for (const event of withinWorkout) {
    // A history that is stored well is already alternating and starts with a
    // pause. Rebuilding that here too keeps a clipped or hand-edited row from
    // reaching HealthKit as a resume that ends an interval which never began.
    const expected = events.length % 2 === 0 ? 'pause' : 'resume';
    if (event.kind !== expected) {
      continue;
    }
    events.push({ type: event.kind, timestampMs: event.atMs });
  }

  return events;
}

/**
 * Seconds of actual effort implied by the workout window and its events.
 *
 * Only used to describe the payload in the Apple Health diagnostics: it is what
 * HealthKit should end up reporting as the workout's duration, so a device check
 * can compare it against the app's own elapsed seconds without re-deriving it.
 */
export function impliedActiveSeconds(
  events: readonly WorkoutEventInput[],
  startedAtMs: number,
  endedAtMs: number,
): number {
  let pausedMs = 0;
  let pausedAtMs: number | null = null;

  for (const event of events) {
    if (event.type === 'pause') {
      pausedAtMs = event.timestampMs;
      continue;
    }
    if (pausedAtMs !== null) {
      pausedMs += event.timestampMs - pausedAtMs;
      pausedAtMs = null;
    }
  }

  // A history that ends on a pause is a ride that was finished while paused, so
  // the break runs to the end of the workout.
  if (pausedAtMs !== null) {
    pausedMs += endedAtMs - pausedAtMs;
  }

  return Math.max(0, (endedAtMs - startedAtMs - pausedMs) / 1000);
}
