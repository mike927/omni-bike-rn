import { useEffect, useCallback, useRef } from 'react';

import { MetronomeEngine } from '../../../services/metronome/MetronomeEngine';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { BikeStatus } from '../../../services/ble/BikeAdapter';
import { TrainingPhase, type MetricSnapshot } from '../../../types/training';

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
    useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Started);

    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine();
    }
    engineRef.current.start();
  }, []);

  const pause = useCallback(() => {
    useTrainingSessionStore.getState().pause();
    useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Paused);
    engineRef.current?.stop();
  }, []);

  const resume = useCallback(() => {
    useTrainingSessionStore.getState().resume();
    useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Started);
    engineRef.current?.start();
  }, []);

  const finish = useCallback(() => {
    useTrainingSessionStore.getState().finish();
    useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Stopped);
    engineRef.current?.stop();
    engineRef.current = null;
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Reset);
    useTrainingSessionStore.getState().reset();
  }, []);

  // ── Sync from Bike to App ──────────────────────────────
  const latestBikeStatus = useDeviceConnectionStore((s) => s.latestBikeMetrics?.status);

  useEffect(() => {
    if (!latestBikeStatus) return;
    const currentPhase = useTrainingSessionStore.getState().phase;

    if (latestBikeStatus === BikeStatus.Started) {
      if (currentPhase === TrainingPhase.Idle) {
        start();
      } else if (currentPhase === TrainingPhase.Paused) {
        resume();
      }
    } else if (latestBikeStatus === BikeStatus.Paused) {
      if (currentPhase === TrainingPhase.Active) {
        pause();
      }
    } else if (latestBikeStatus === BikeStatus.Stopped) {
      if (currentPhase === TrainingPhase.Active || currentPhase === TrainingPhase.Paused) {
        finish();
      }
    }
  }, [latestBikeStatus, start, resume, pause, finish]);

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
