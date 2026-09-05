import { kcalPerSecond } from '../calories/keytel';
import type { MetricSnapshot, SessionAccumulator, TrainingTickInput } from '../../types/training';

/** Joules-to-kcal conversion factor (1 kcal ≈ 4 186 J). */
const JOULES_PER_KCAL = 4186;

/**
 * Gross mechanical efficiency of human cycling.
 * The body converts roughly 20–25 % of metabolic energy into pedal power;
 * the rest is dissipated as heat. 0.25 is the standard value used by most
 * cycling computers (Garmin, Wahoo, Zwift).
 */
const GROSS_MECHANICAL_EFFICIENCY = 0.25;

/**
 * The distance slice of the accumulator: the workout-relative total plus the
 * rebasing state that keeps it workout-relative.
 */
export type NormalizedDistanceState = Pick<
  SessionAccumulator,
  'totalDistance' | 'initialDistance' | 'lastBikeDistance'
>;
type CalorieState = Pick<
  SessionAccumulator,
  | 'totalCalories'
  | 'bikeCaloriesOffset'
  | 'lastBikeTotalEnergyKcal'
  | 'watchCaloriesOffset'
  | 'lastWatchActiveKcal'
  | 'lastCalorieSourceMode'
>;

/**
 * Distance state of a ride that has not recorded a single second yet.
 *
 * Frozen: every replay seeds from this one object, so a caller that mutated it
 * in place would move the starting line for every ride exported afterwards.
 */
export const INITIAL_NORMALIZED_DISTANCE: Readonly<NormalizedDistanceState> = Object.freeze({
  totalDistance: 0,
  initialDistance: null,
  lastBikeDistance: null,
});

/**
 * One step of distance normalization: prefer raw hardware output over derived
 * speed integration, and keep the running total workout-relative rather than
 * machine-relative.
 *
 * A trainer's own counter is whatever it happened to be showing when the ride
 * started, and it drops back to zero on a power cycle mid-ride. Neither is a
 * distance the rider covered, so the counter is rebased on the first reading and
 * again on every reset, and only the rebased total ever leaves this module. The
 * raw reading stays in `MetricSnapshot.distance`, so anything that exports a
 * per-second distance must take it from here and not from that field.
 *
 * `elapsedDeltaSeconds` is the seconds this reading stands for: 1 for a live
 * tick, and the gap between two persisted samples when the series is being
 * replayed after the fact.
 */
export function normalizeDistanceStep(
  state: NormalizedDistanceState,
  reading: Pick<MetricSnapshot, 'distance' | 'speed'>,
  elapsedDeltaSeconds: number,
): NormalizedDistanceState {
  const { totalDistance, initialDistance, lastBikeDistance } = state;

  if (reading.distance === null) {
    // Fallback: distance delta from speed (km/h → m/s = speed / 3.6).
    return {
      totalDistance: totalDistance + (reading.speed / 3.6) * elapsedDeltaSeconds,
      initialDistance,
      lastBikeDistance,
    };
  }

  // Rebase when the bike counter reset (e.g. power cycle) or on the first data point.
  const shouldRebaseDistance =
    initialDistance === null || (lastBikeDistance !== null && reading.distance < lastBikeDistance);
  const nextInitialDistance = shouldRebaseDistance ? reading.distance - totalDistance : initialDistance;

  return {
    totalDistance: reading.distance - (nextInitialDistance ?? reading.distance),
    initialDistance: nextInitialDistance,
    lastBikeDistance: reading.distance,
  };
}

/** Distance for one live 1 Hz tick. */
function advanceDistance(state: SessionAccumulator, metrics: TrainingTickInput['metrics']): NormalizedDistanceState {
  return normalizeDistanceStep(state, metrics, 1);
}

/**
 * Calorie priority: Watch-computed active kcal > Keytel HR-based personalized
 * formula > app-power formula > bike-reported energy > none. Watch wins even
 * when `hasLiveExternalHr` is true (the Watch usually provides HR too). Keytel
 * slots between Watch and the generic power formula on the no-Watch +
 * external-HR path; it needs `keytelInputs` and a live HR value, otherwise the
 * chain falls through to the power-based formula. The power-based formula is
 * gated on `hasBikePower` (`metrics.power` is a real reading this tick), not on
 * HR liveness: HR is optional, so a ride with valid power and no HR source must
 * still accumulate power-based calories rather than falling through to the
 * lower-priority bike-reported tier (or to nothing at all). The flag is also
 * what keeps the bike-reported tier reachable: a machine that streams energy
 * but never Instantaneous Power has no power reading, so it drops through to
 * its own reported energy instead of recording a fabricated 0 W.
 */
function advanceCalories(state: SessionAccumulator, input: TrainingTickInput): CalorieState {
  const { metrics, bikeTotalEnergyKcal, watchActiveKcal, hasLiveExternalHr, hasBikePower, keytelInputs } = input;
  const {
    totalCalories,
    bikeCaloriesOffset,
    lastBikeTotalEnergyKcal,
    watchCaloriesOffset,
    lastWatchActiveKcal,
    lastCalorieSourceMode,
  } = state;

  if (watchActiveKcal !== null) {
    const shouldRebaseWatchCalories =
      watchCaloriesOffset === null ||
      lastCalorieSourceMode !== 'watch' ||
      (lastWatchActiveKcal !== null && watchActiveKcal < lastWatchActiveKcal);
    const nextWatchCaloriesOffset = shouldRebaseWatchCalories ? totalCalories - watchActiveKcal : watchCaloriesOffset;

    return {
      totalCalories: watchActiveKcal + (nextWatchCaloriesOffset ?? 0),
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      watchCaloriesOffset: nextWatchCaloriesOffset,
      lastWatchActiveKcal: watchActiveKcal,
      lastCalorieSourceMode: 'watch',
    };
  }

  if (hasLiveExternalHr && keytelInputs !== null && metrics.heartRate !== null && metrics.heartRate > 0) {
    const calorieDelta = kcalPerSecond({
      sex: keytelInputs.sex,
      ageYears: keytelInputs.ageYears,
      weightKg: keytelInputs.weightKg,
      heartRateBpm: metrics.heartRate,
    });
    return {
      totalCalories: totalCalories + calorieDelta,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
      lastCalorieSourceMode: 'keytel',
    };
  }

  if (hasBikePower) {
    // Metabolic calorie delta: mechanical work adjusted for gross efficiency.
    // Reachable with or without a live HR source: HR is optional, a real power
    // reading is not. `metrics.power` may legitimately be 0 here (coasting).
    const calorieDelta = metrics.power / JOULES_PER_KCAL / GROSS_MECHANICAL_EFFICIENCY;
    return {
      totalCalories: totalCalories + calorieDelta,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
      lastCalorieSourceMode: 'app',
    };
  }

  if (bikeTotalEnergyKcal === null) {
    return {
      totalCalories,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
      lastCalorieSourceMode: 'none',
    };
  }

  const shouldRebaseBikeCalories =
    bikeCaloriesOffset === null ||
    lastCalorieSourceMode !== 'bike' ||
    (lastBikeTotalEnergyKcal !== null && bikeTotalEnergyKcal < lastBikeTotalEnergyKcal);
  const nextBikeCaloriesOffset = shouldRebaseBikeCalories ? totalCalories - bikeTotalEnergyKcal : bikeCaloriesOffset;

  return {
    totalCalories: bikeTotalEnergyKcal + (nextBikeCaloriesOffset ?? 0),
    bikeCaloriesOffset: nextBikeCaloriesOffset,
    lastBikeTotalEnergyKcal: bikeTotalEnergyKcal,
    watchCaloriesOffset: null,
    lastWatchActiveKcal: null,
    lastCalorieSourceMode: 'bike',
  };
}

/**
 * Advance the session accumulator by one active 1 Hz tick. Pure: no store
 * reads, no clock. The caller (training session store) applies the phase guard
 * and persists the result.
 */
export function advanceSession(state: SessionAccumulator, input: TrainingTickInput): SessionAccumulator {
  return {
    elapsedSeconds: state.elapsedSeconds + 1,
    currentMetrics: input.metrics,
    ...advanceDistance(state, input.metrics),
    ...advanceCalories(state, input),
  };
}
