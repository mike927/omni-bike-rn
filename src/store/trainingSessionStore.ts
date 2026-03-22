import { create } from 'zustand';

import { TrainingPhase, VALID_TRANSITIONS, type MetricSnapshot } from '../types/training';

const INITIAL_METRICS: MetricSnapshot = {
  speed: 0,
  cadence: 0,
  power: 0,
  heartRate: null,
  resistance: null,
};

/** Joules-to-kcal conversion factor (1 kcal ≈ 4 186 J). */
const JOULES_PER_KCAL = 4186;

export interface TrainingSessionStore {
  // ── State ──────────────────────────────────────────────
  phase: TrainingPhase;
  elapsedSeconds: number;
  totalDistance: number; // meters
  totalCalories: number; // kcal
  currentMetrics: MetricSnapshot;

  // ── Actions ────────────────────────────────────────────
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;

  /**
   * Called once per second by the MetronomeEngine.
   *
   * Receives a **pre-merged** MetricSnapshot (the engine has already applied
   * source-priority logic for HR, calories, etc.) so the store stays
   * source-agnostic and easy to extend with new sensors.
   */
  tick: (metrics: MetricSnapshot) => void;
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
  currentMetrics: { ...INITIAL_METRICS },

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
      phase: transitionTo(get().phase, TrainingPhase.Idle),
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      currentMetrics: { ...INITIAL_METRICS },
    }),

  // ── Tick (called by MetronomeEngine every 1 s) ─────────
  tick: (metrics) => {
    const { phase, elapsedSeconds, totalDistance, totalCalories } = get();
    if (phase !== TrainingPhase.Active) return;

    // Distance delta: speed is km/h → m/s = speed / 3.6, for 1 second interval
    const distanceDelta = (metrics.speed / 3.6) * 1;

    // Calorie delta: power (W) × 1 s = joules → kcal
    const calorieDelta = metrics.power / JOULES_PER_KCAL;

    set({
      elapsedSeconds: elapsedSeconds + 1,
      totalDistance: totalDistance + distanceDelta,
      totalCalories: totalCalories + calorieDelta,
      currentMetrics: metrics,
    });
  },
}));
