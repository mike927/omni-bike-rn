import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import type { MetricSnapshot, TrainingPhase } from '../../../types/training';
import {
  discardUnsavedSession,
  finishSession,
  finishSessionAndDisconnect,
  pauseSession,
  resetSession,
  resumeSession,
  retryFinishSave,
  startSession,
  type DiscardSessionOutcome,
  type FinishSessionOutcome,
} from '../sessionController';

interface UseTrainingSessionReturn {
  // ── Read-only state ────────────────────────────────────
  phase: TrainingPhase;
  elapsedSeconds: number;
  totalDistance: number;
  totalCalories: number;
  currentMetrics: MetricSnapshot;

  // ── Actions ────────────────────────────────────────────
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  finishAndDisconnect: () => Promise<FinishSessionOutcome>;
  /** Write a finished ride again after its save failed, under the same identity. */
  retrySave: () => Promise<FinishSessionOutcome>;
  /** Abandon a finished ride whose save failed, on the user's explicit request. */
  discardUnsaved: () => Promise<DiscardSessionOutcome>;
  reset: () => Promise<void>;
}

/**
 * Screen-facing view of the training session: live state plus the commands.
 *
 * Deliberately effect-free. The ride is global and outlives any screen, so the
 * recording clock and the bike observers belong to `useTrainingSessionLifecycle`
 * at the app root. Mount this hook on as many screens as you like, in any
 * order: mounting it starts nothing and unmounting it stops nothing.
 */
export function useTrainingSession(): UseTrainingSessionReturn {
  const phase = useTrainingSessionStore((s) => s.phase);
  const elapsedSeconds = useTrainingSessionStore((s) => s.elapsedSeconds);
  const totalDistance = useTrainingSessionStore((s) => s.totalDistance);
  const totalCalories = useTrainingSessionStore((s) => s.totalCalories);
  const currentMetrics = useTrainingSessionStore((s) => s.currentMetrics);

  return {
    phase,
    elapsedSeconds,
    totalDistance,
    totalCalories,
    currentMetrics,
    start: startSession,
    pause: pauseSession,
    resume: resumeSession,
    finish: finishSession,
    finishAndDisconnect: finishSessionAndDisconnect,
    retrySave: retryFinishSave,
    discardUnsaved: discardUnsavedSession,
    reset: resetSession,
  };
}
