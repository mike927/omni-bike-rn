import { kcalPerSecond } from '../calories/keytel';
import type { SessionAccumulator, TrainingTickInput } from '../../types/training';

/** Joules-to-kcal conversion factor (1 kcal ≈ 4 186 J). */
const JOULES_PER_KCAL = 4186;

/**
 * Gross mechanical efficiency of human cycling.
 * The body converts roughly 20–25 % of metabolic energy into pedal power;
 * the rest is dissipated as heat. 0.25 is the standard value used by most
 * cycling computers (Garmin, Wahoo, Zwift).
 */
const GROSS_MECHANICAL_EFFICIENCY = 0.25;

type DistanceState = Pick<SessionAccumulator, 'totalDistance' | 'initialDistance' | 'lastBikeDistance'>;
type CalorieState = Pick<
  SessionAccumulator,
  | 'totalCalories'
  | 'bikeCaloriesOffset'
  | 'lastBikeTotalEnergyKcal'
  | 'watchCaloriesOffset'
  | 'lastWatchActiveKcal'
  | 'lastCalorieSourceMode'
>;

/** Distance: prefer raw hardware output over derived speed integration. */
function advanceDistance(state: SessionAccumulator, metrics: TrainingTickInput['metrics']): DistanceState {
  const { totalDistance, initialDistance, lastBikeDistance } = state;

  if (metrics.distance === null) {
    // Fallback: distance delta from speed (km/h → m/s = speed / 3.6 for 1 s).
    return {
      totalDistance: totalDistance + (metrics.speed / 3.6) * 1,
      initialDistance,
      lastBikeDistance,
    };
  }

  // Rebase when the bike counter reset (e.g. power cycle) or on the first data point.
  const shouldRebaseDistance =
    initialDistance === null || (lastBikeDistance !== null && metrics.distance < lastBikeDistance);
  const nextInitialDistance = shouldRebaseDistance ? metrics.distance - totalDistance : initialDistance;

  return {
    totalDistance: metrics.distance - (nextInitialDistance ?? metrics.distance),
    initialDistance: nextInitialDistance,
    lastBikeDistance: metrics.distance,
  };
}

/**
 * Calorie priority: Watch-computed active kcal > Keytel HR-based personalized
 * formula > app-power formula > bike-reported energy > none. Watch wins even
 * when `hasLiveExternalHr` is true (the Watch usually provides HR too). Keytel
 * slots between Watch and the generic power formula on the no-Watch +
 * external-HR path; it needs `keytelInputs` and a live HR value, otherwise the
 * chain falls through to the power-based formula.
 */
function advanceCalories(state: SessionAccumulator, input: TrainingTickInput): CalorieState {
  const { metrics, bikeTotalEnergyKcal, watchActiveKcal, hasLiveExternalHr, keytelInputs } = input;
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

  if (hasLiveExternalHr) {
    // Metabolic calorie delta: mechanical work adjusted for gross efficiency.
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
