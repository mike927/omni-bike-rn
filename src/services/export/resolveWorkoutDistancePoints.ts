import {
  INITIAL_NORMALIZED_DISTANCE,
  normalizeDistanceStep,
  type NormalizedDistanceState,
} from '../training/sessionAccumulator';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';

/** A persisted sample paired with the metres an export should publish for it. */
export interface WorkoutDistancePoint {
  readonly sample: PersistedTrainingSample;
  /** Cumulative workout-relative metres at that sample. */
  readonly distanceMeters: number;
}

/**
 * Cumulative workout-relative distance, in metres, for each persisted sample of
 * a ride, in sample order.
 *
 * Exports need the same distance the app shows: metres covered during this
 * ride. `PersistedTrainingSample.metrics.distance` is not that number, it is the
 * trainer's own odometer, which starts wherever the machine was left and
 * restarts at zero on a power cycle. A ride of 35 m can be stored as 500, 520,
 * 10, 25 (audit A07).
 *
 * Rows recorded since `sessionDistanceMeters` exists carry the accumulator's own
 * normalized total, so nothing has to be inferred and they are exported as
 * recorded. Older rows kept no normalized history at all, so it is replayed here
 * through the same normalization step the live tick uses. The replay is exact
 * for an uninterrupted 1 Hz sample stream and approximate otherwise, in two
 * known ways:
 *
 * - Seconds whose sample write failed are missing from the stream. A gap is
 *   replayed as the surrounding reading held for its whole duration.
 * - A ride resumed after the app was killed rebases the live counter, so the
 *   metres the trainer counted while the app was gone stay out of the stored
 *   ride total. A straight replay cannot see that gap and would add them back,
 *   and the error is not small: it equals whatever the trainer counted while the
 *   app was dead, so it is unbounded in principle. Counters 500, 510, then 610,
 *   620 after the restore replay to 0, 10, 110, 120 against a stored total of
 *   20 m.
 *
 * The stored `session.totalDistanceMeters` is the one thing such a ride does
 * know for certain, so **every replayed value** is capped at it, not only the
 * restore case above: the gap-hold approximation can integrate past the
 * stored total too, on a long enough held reading, and the cap clips that the
 * same way. The track can therefore flatten early, which is visible but
 * honest, instead of ending several times above the lap total it is printed
 * under. Recorded values are never capped: they are the accumulator's own
 * output, and capping them could only hide a disagreement worth seeing.
 *
 * The result is always non-decreasing: TCX `DistanceMeters` is a cumulative
 * value, and a dip would be read as a rewind rather than as a stall.
 */
export function resolveWorkoutDistancePoints(
  session: PersistedTrainingSession,
  samples: readonly PersistedTrainingSample[],
): WorkoutDistancePoint[] {
  let normalized: NormalizedDistanceState = INITIAL_NORMALIZED_DISTANCE;
  let previousElapsedSeconds = 0;
  let previousMeters = 0;
  let reconstructedAny = false;
  const points: WorkoutDistancePoint[] = [];

  for (const sample of samples) {
    normalized = normalizeDistanceStep(
      normalized,
      sample.metrics,
      Math.max(0, sample.elapsedSeconds - previousElapsedSeconds),
    );
    previousElapsedSeconds = sample.elapsedSeconds;

    const recorded = sample.sessionDistanceMeters;
    if (recorded === undefined) {
      reconstructedAny = true;
    }

    const resolved = recorded ?? Math.min(normalized.totalDistance, session.totalDistanceMeters);
    const distanceMeters = Math.max(previousMeters, resolved);
    previousMeters = distanceMeters;
    points.push({ sample, distanceMeters });
  }

  // Last resort for a legacy ride whose samples carry neither a counter nor any
  // speed to integrate, yet whose stored total says the rider went somewhere: a
  // ride restored from disk and then finished without a single further reading.
  // Spreading the stored total over elapsed time is the only signal left, and it
  // at least keeps the track and the lap total telling the same story.
  if (reconstructedAny && previousMeters === 0 && session.totalDistanceMeters > 0 && session.elapsedSeconds > 0) {
    return samples.map((sample) => ({
      sample,
      distanceMeters: (sample.elapsedSeconds / session.elapsedSeconds) * session.totalDistanceMeters,
    }));
  }

  return points;
}
