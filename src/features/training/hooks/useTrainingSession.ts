import { useCallback, useRef } from 'react';

import { MetronomeEngine } from '../../../services/metronome/MetronomeEngine';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import type { TrainingPhase, MetricSnapshot } from '../../../types/training';

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
  reset: () => void;
}

/**
 * Public API hook for the training session lifecycle.
 *
 * Wraps {@link useTrainingSessionStore} with selectors and manages the
 * {@link MetronomeEngine} lifecycle (start/stop) alongside session phase
 * transitions.
 */
export function useTrainingSession(): UseTrainingSessionReturn {
  const engineRef = useRef<MetronomeEngine | null>(null);

  const phase = useTrainingSessionStore((s) => s.phase);
  const elapsedSeconds = useTrainingSessionStore((s) => s.elapsedSeconds);
  const totalDistance = useTrainingSessionStore((s) => s.totalDistance);
  const totalCalories = useTrainingSessionStore((s) => s.totalCalories);
  const currentMetrics = useTrainingSessionStore((s) => s.currentMetrics);

  const start = useCallback(() => {
    useTrainingSessionStore.getState().start();

    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine();
    }
    engineRef.current.start();
  }, []);

  const pause = useCallback(() => {
    useTrainingSessionStore.getState().pause();
    engineRef.current?.stop();
  }, []);

  const resume = useCallback(() => {
    useTrainingSessionStore.getState().resume();
    engineRef.current?.start();
  }, []);

  const finish = useCallback(() => {
    useTrainingSessionStore.getState().finish();
    engineRef.current?.stop();
    engineRef.current = null;
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    useTrainingSessionStore.getState().reset();
  }, []);

  return {
    phase,
    elapsedSeconds,
    totalDistance,
    totalCalories,
    currentMetrics,
    start,
    pause,
    resume,
    finish,
    reset,
  };
}
