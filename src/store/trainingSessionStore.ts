import { create } from 'zustand';

import {
  TrainingPhase,
  VALID_TRANSITIONS,
  type CalorieSourceMode,
  type MetricSnapshot,
  type TrainingSessionRestoreInput,
  type TrainingTickInput,
} from '../types/training';

const INITIAL_METRICS: MetricSnapshot = {
  speed: 0,
  cadence: 0,
  power: 0,
  heartRate: null,
  resistance: null,
  distance: null,
};

/** Joules-to-kcal conversion factor (1 kcal ≈ 4 186 J). */
const JOULES_PER_KCAL = 4186;

/**
 * Gross mechanical efficiency of human cycling.
 * The body converts roughly 20–25 % of metabolic energy into pedal power;
 * the rest is dissipated as heat. 0.25 is the standard value used by most
 * cycling computers (Garmin, Wahoo, Zwift).
 */
const GROSS_MECHANICAL_EFFICIENCY = 0.25;

export interface TrainingSessionStore {
  // ── State ──────────────────────────────────────────────
  phase: TrainingPhase;
  elapsedSeconds: number;
  totalDistance: number; // meters
  totalCalories: number; // kcal
  currentMetrics: MetricSnapshot;
  initialDistance: number | null;
  bikeCaloriesOffset: number | null;
  lastBikeTotalEnergyKcal: number | null;
  lastBikeDistance: number | null;
  lastCalorieSourceMode: CalorieSourceMode;

  // ── Actions ────────────────────────────────────────────
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
  restore: (input: TrainingSessionRestoreInput) => void;

  /**
   * Called once per second by the MetronomeEngine.
   *
   * Receives a **pre-merged** 1 Hz tick payload (the engine has already applied
   * source-priority logic for HR and gathered calorie-source metadata) so the
   * store stays source-agnostic and easy to extend with new sensors.
   */
  tick: (input: TrainingTickInput) => void;
}

function transitionTo(from: TrainingPhase, to: TrainingPhase): TrainingPhase {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    console.error(`[TrainingSessionStore] Invalid transition ${from} → ${to}`);
    return from;
  }
  return to;
}

export const useTrainingSessionStore = create<TrainingSessionStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────
  phase: TrainingPhase.Idle,
  elapsedSeconds: 0,
  totalDistance: 0,
  totalCalories: 0,
  initialDistance: null,
  bikeCaloriesOffset: null,
  lastBikeTotalEnergyKcal: null,
  lastBikeDistance: null,
  lastCalorieSourceMode: 'none',
  currentMetrics: { ...INITIAL_METRICS, distance: null },

  // ── Transitions ────────────────────────────────────────
  start: () => set({ phase: transitionTo(get().phase, TrainingPhase.Active) }),
  pause: () => set({ phase: transitionTo(get().phase, TrainingPhase.Paused) }),
  resume: () => {
    if (get().phase !== TrainingPhase.Paused) {
      console.error(`[TrainingSessionStore] resume() is only valid from Paused, current: ${get().phase}`);
      return;
    }
    set({ phase: TrainingPhase.Active });
  },
  finish: () => set({ phase: transitionTo(get().phase, TrainingPhase.Finished) }),

  reset: () =>
    set({
      phase: TrainingPhase.Idle,
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      initialDistance: null,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      lastBikeDistance: null,
      lastCalorieSourceMode: 'none',
      currentMetrics: { ...INITIAL_METRICS, distance: null },
    }),

  restore: (input) =>
    set({
      phase: TrainingPhase.Paused,
      elapsedSeconds: input.elapsedSeconds,
      totalDistance: input.totalDistance,
      totalCalories: input.totalCalories,
      currentMetrics: input.currentMetrics,
      initialDistance: null,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      lastBikeDistance: null,
      lastCalorieSourceMode: 'none',
    }),

  // ── Tick (called by MetronomeEngine every 1 s) ─────────
  tick: (input) => {
    const { metrics, bikeTotalEnergyKcal, hasLiveExternalHr } = input;
    const {
      phase,
      elapsedSeconds,
      totalDistance,
      totalCalories,
      initialDistance,
      bikeCaloriesOffset,
      lastBikeTotalEnergyKcal,
      lastBikeDistance,
      lastCalorieSourceMode,
    } = get();
    if (phase !== TrainingPhase.Active) return;

    // Distance logic: Prefer raw hardware output over derived speed integration
    let newTotalDistance = totalDistance;
    let newInitialDistance = initialDistance;
    let nextLastBikeDistance = lastBikeDistance;

    if (metrics.distance !== null && metrics.distance !== undefined) {
      // Distance Rebase Logic: Detect if the bike counter reset (e.g. power cycle)
      // or if this is the first data point for the session.
      const shouldRebaseDistance =
        initialDistance === null || (lastBikeDistance !== null && metrics.distance < lastBikeDistance);

      if (shouldRebaseDistance) {
        // Capture a new baseline. We subtract the current totalDistance from the hardware
        // reading so that the calculated totalDistance remains monotonic and continuous.
        newInitialDistance = metrics.distance - totalDistance;
      }

      newTotalDistance = metrics.distance - (newInitialDistance ?? metrics.distance);
      nextLastBikeDistance = metrics.distance;
    } else {
      // Fallback: Distance delta (speed is km/h → m/s = speed / 3.6 for 1s)
      const distanceDelta = (metrics.speed / 3.6) * 1;
      newTotalDistance += distanceDelta;
    }

    let nextTotalCalories = totalCalories;
    let nextBikeCaloriesOffset = bikeCaloriesOffset;
    let nextLastBikeTotalEnergyKcal: number | null = null;
    let nextCalorieSourceMode: CalorieSourceMode = 'none';

    if (hasLiveExternalHr) {
      // Metabolic calorie delta: mechanical work adjusted for gross efficiency
      const calorieDelta = metrics.power / JOULES_PER_KCAL / GROSS_MECHANICAL_EFFICIENCY;
      nextTotalCalories = totalCalories + calorieDelta;
      nextBikeCaloriesOffset = null;
      nextCalorieSourceMode = 'app';
    } else if (bikeTotalEnergyKcal === null) {
      nextBikeCaloriesOffset = null;
    } else {
      const shouldRebaseBikeCalories =
        bikeCaloriesOffset === null ||
        lastCalorieSourceMode !== 'bike' ||
        (lastBikeTotalEnergyKcal !== null && bikeTotalEnergyKcal < lastBikeTotalEnergyKcal);

      if (shouldRebaseBikeCalories) {
        nextBikeCaloriesOffset = totalCalories - bikeTotalEnergyKcal;
      }

      nextTotalCalories = bikeTotalEnergyKcal + (nextBikeCaloriesOffset ?? 0);
      nextLastBikeTotalEnergyKcal = bikeTotalEnergyKcal;
      nextCalorieSourceMode = 'bike';
    }

    set({
      elapsedSeconds: elapsedSeconds + 1,
      totalDistance: newTotalDistance,
      initialDistance: newInitialDistance,
      totalCalories: nextTotalCalories,
      bikeCaloriesOffset: nextBikeCaloriesOffset,
      lastBikeTotalEnergyKcal: nextLastBikeTotalEnergyKcal,
      lastBikeDistance: nextLastBikeDistance,
      lastCalorieSourceMode: nextCalorieSourceMode,
      currentMetrics: metrics,
    });
  },
}));
