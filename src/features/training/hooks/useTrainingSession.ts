import { useEffect, useCallback, useRef } from 'react';

import { MetronomeEngine } from '../../../services/metronome/MetronomeEngine';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { BikeStatus } from '../../../services/ble/BikeAdapter';
import { TrainingPhase, type MetricSnapshot } from '../../../types/training';
import { disconnectAllDeviceConnections } from './useDeviceConnection';
import { getActiveSessionId } from './useTrainingSessionPersistence';

const FINISH_STOP_COMMAND_TIMEOUT_MS = 2000;

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
  finishAndDisconnect: () => Promise<string | null>;
  reset: () => Promise<void>;
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
  const pendingFinishStopRef = useRef<Promise<void> | null>(null);

  const phase = useTrainingSessionStore((s) => s.phase);
  const elapsedSeconds = useTrainingSessionStore((s) => s.elapsedSeconds);
  const totalDistance = useTrainingSessionStore((s) => s.totalDistance);
  const totalCalories = useTrainingSessionStore((s) => s.totalCalories);
  const currentMetrics = useTrainingSessionStore((s) => s.currentMetrics);

  const ensureEngineRunning = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine();
    }

    engineRef.current.start();
  }, []);

  const stopEngine = useCallback((clearRef: boolean) => {
    engineRef.current?.stop();

    if (clearRef) {
      engineRef.current = null;
    }
  }, []);

  const awaitPendingFinishStop = useCallback(async () => {
    const pendingStop = pendingFinishStopRef.current;
    if (!pendingStop) {
      return;
    }

    let timeoutId: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        pendingStop,
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, FINISH_STOP_COMMAND_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      pendingFinishStopRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (useTrainingSessionStore.getState().phase !== TrainingPhase.Idle) {
      return;
    }

    const bikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
    if (!bikeAdapter) {
      console.warn('[useTrainingSession] Cannot start session: bike not connected');
      return;
    }

    useTrainingSessionStore.getState().start();
    void bikeAdapter.setControlState(BikeStatus.Started);
    ensureEngineRunning();
  }, [ensureEngineRunning]);

  const pause = useCallback(() => {
    if (useTrainingSessionStore.getState().phase !== TrainingPhase.Active) {
      return;
    }

    useTrainingSessionStore.getState().pause();
    void useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Paused);
    stopEngine(false);
  }, [stopEngine]);

  const resume = useCallback(() => {
    if (useTrainingSessionStore.getState().phase !== TrainingPhase.Paused) {
      return;
    }

    useTrainingSessionStore.getState().resume();
    void useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Started);
    ensureEngineRunning();
  }, [ensureEngineRunning]);

  const finishSession = useCallback(() => {
    const bikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
    if (bikeAdapter) {
      pendingFinishStopRef.current = bikeAdapter.setControlState(BikeStatus.Stopped).catch((err: unknown) => {
        console.error('[useTrainingSession] Bike stop failed before disconnect:', err);
      });
    } else {
      pendingFinishStopRef.current = null;
    }

    useTrainingSessionStore.getState().finish();
    stopEngine(true);
  }, [stopEngine]);

  const resetSessionAndConnections = useCallback(async () => {
    await awaitPendingFinishStop();
    await disconnectAllDeviceConnections({ updateReconnectState: true, suppressAutoReconnect: true });
    useTrainingSessionStore.getState().reset();
  }, [awaitPendingFinishStop]);

  const finish = useCallback(() => {
    const currentPhase = useTrainingSessionStore.getState().phase;
    if (currentPhase !== TrainingPhase.Active && currentPhase !== TrainingPhase.Paused) {
      return;
    }

    finishSession();
  }, [finishSession]);

  const finishAndDisconnect = useCallback(async (): Promise<string | null> => {
    const currentPhase = useTrainingSessionStore.getState().phase;
    if (currentPhase !== TrainingPhase.Active && currentPhase !== TrainingPhase.Paused) {
      return null;
    }

    finishSession();

    const sessionId = getActiveSessionId();

    await awaitPendingFinishStop();
    await disconnectAllDeviceConnections({ updateReconnectState: true, suppressAutoReconnect: true });
    useTrainingSessionStore.getState().reset();

    return sessionId;
  }, [finishSession, awaitPendingFinishStop]);

  const reset = useCallback(async () => {
    const currentPhase = useTrainingSessionStore.getState().phase;

    stopEngine(true);
    if (currentPhase === TrainingPhase.Idle) {
      pendingFinishStopRef.current = null;
      return;
    }

    await resetSessionAndConnections();
  }, [resetSessionAndConnections, stopEngine]);

  const syncFromBikeStatus = useCallback(
    (status: BikeStatus) => {
      const currentPhase = useTrainingSessionStore.getState().phase;

      if (status === BikeStatus.Started) {
        if (currentPhase === TrainingPhase.Idle) {
          useTrainingSessionStore.getState().start();
          ensureEngineRunning();
        } else if (currentPhase === TrainingPhase.Paused) {
          useTrainingSessionStore.getState().resume();
          ensureEngineRunning();
        }
      } else if (status === BikeStatus.Paused || status === BikeStatus.Stopped) {
        // Ignore when already Paused — a Stopped echo can come from our own setControlState(Stopped) call.
        // When Active, both Paused and Stopped should freeze the session until the user resumes or finishes.
        if (currentPhase === TrainingPhase.Active) {
          useTrainingSessionStore.getState().pause();
          stopEngine(false);
        }
      }
    },
    [ensureEngineRunning, stopEngine],
  );

  // ── Sync from Bike to App ──────────────────────────────
  const latestBikeStatus = useDeviceConnectionStore((s) => s.latestBikeMetrics?.status);

  useEffect(() => {
    if (!latestBikeStatus) return;
    syncFromBikeStatus(latestBikeStatus);
  }, [latestBikeStatus, syncFromBikeStatus]);

  useEffect(
    () => () => {
      stopEngine(true);
    },
    [stopEngine],
  );

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
    finishAndDisconnect,
    reset,
  };
}
