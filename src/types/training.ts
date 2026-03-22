/**
 * Training session types shared across store, engine, and feature hooks.
 */

export enum TrainingPhase {
  Idle = 'idle',
  Active = 'active',
  Paused = 'paused',
  Finished = 'finished',
}

/**
 * Point-in-time snapshot of all training metrics.
 * Sources (bike, HR strap, watch, etc.) are merged by the MetronomeEngine
 * before writing here — consumers never need to know which device provided a value.
 */
export interface MetricSnapshot {
  /** Current speed in km/h. */
  speed: number;
  /** Pedalling cadence in RPM. */
  cadence: number;
  /** Instantaneous power in watts. */
  power: number;
  /** Heart rate in BPM, null when no HR source is available. */
  heartRate: number | null;
  /** Resistance level (machine-specific), null when not reported. */
  resistance: number | null;
}

/** Allowed transitions for the training state machine. */
export const VALID_TRANSITIONS: Readonly<Record<TrainingPhase, readonly TrainingPhase[]>> = {
  [TrainingPhase.Idle]: [TrainingPhase.Active],
  [TrainingPhase.Active]: [TrainingPhase.Paused, TrainingPhase.Finished],
  [TrainingPhase.Paused]: [TrainingPhase.Active, TrainingPhase.Finished],
  [TrainingPhase.Finished]: [TrainingPhase.Idle],
} as const;
