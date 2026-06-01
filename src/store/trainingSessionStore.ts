import { create } from 'zustand';

import { advanceSession } from '../services/training/sessionAccumulator';
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
  /** Offset that maps the Watch's cumulative kcal stream onto `totalCalories`. */
  watchCaloriesOffset: number | null;
  /** Last Watch cumulative kcal observed; used to detect counter resets. */
  lastWatchActiveKcal: number | null;
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
  watchCaloriesOffset: null,
  lastWatchActiveKcal: null,
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
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
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
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
      lastCalorieSourceMode: 'none',
    }),

  // ── Tick (called by MetronomeEngine every 1 s) ─────────
  tick: (input) => {
    if (get().phase !== TrainingPhase.Active) return;
    set(advanceSession(get(), input));
  },
}));
