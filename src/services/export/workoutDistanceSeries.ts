import {
  INITIAL_NORMALIZED_DISTANCE,
  normalizeDistanceStep,
  type NormalizedDistanceState,
} from '../training/sessionAccumulator';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';

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
 * normalized total, so nothing has to be inferred. Older rows kept no normalized
 * history at all, so it is replayed here through the same normalization step the
 * live tick uses. The replay is exact for an uninterrupted 1 Hz sample stream
 * and approximate otherwise, in two known ways:
 *
 * - Seconds whose sample write failed are missing from the stream. A gap is
 *   replayed as the surrounding reading held for its whole duration.
 * - A ride resumed after the app was killed rebases the live counter, so the
 *   distance the trainer counted while the app was gone is dropped from the
 *   total but not from a straight replay. The replay can therefore run slightly
 *   ahead of the stored ride total across such a gap.
 *
 * The result is always non-decreasing: TCX `DistanceMeters` is a cumulative
 * value, and a dip would be read as a rewind rather than as a stall.
 */
export function resolveWorkoutDistanceSeries(
  session: PersistedTrainingSession,
  samples: readonly PersistedTrainingSample[],
): number[] {
  let normalized: NormalizedDistanceState = INITIAL_NORMALIZED_DISTANCE;
  let previousElapsedSeconds = 0;
  let previousMeters = 0;
  let reconstructedAny = false;
  const series: number[] = [];

  for (const sample of samples) {
    normalized = normalizeDistanceStep(
      normalized,
      sample.metrics,
      Math.max(0, sample.elapsedSeconds - previousElapsedSeconds),
    );
    previousElapsedSeconds = sample.elapsedSeconds;

    if (sample.sessionDistanceMeters === undefined) {
      reconstructedAny = true;
    }

    const meters = Math.max(previousMeters, sample.sessionDistanceMeters ?? normalized.totalDistance);
    previousMeters = meters;
    series.push(meters);
  }

  // Last resort for a legacy ride whose samples carry neither a counter nor any
  // speed to integrate, yet whose stored total says the rider went somewhere: a
  // ride restored from disk and then finished without a single further reading.
  // Spreading the stored total over elapsed time is the only signal left, and it
  // at least keeps the track and the lap total telling the same story.
  if (reconstructedAny && previousMeters === 0 && session.totalDistanceMeters > 0 && session.elapsedSeconds > 0) {
    return samples.map((sample) => (sample.elapsedSeconds / session.elapsedSeconds) * session.totalDistanceMeters);
  }

  return series;
}
