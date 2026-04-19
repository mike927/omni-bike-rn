import { useEffect, useCallback, useRef } from 'react';

import { MetronomeEngine } from '../../../services/metronome/MetronomeEngine';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { BikeStatus } from '../../../services/ble/BikeAdapter';
import { TrainingPhase, type MetricSnapshot } from '../../../types/training';
import { disconnectAllDeviceConnections, handleUnexpectedBikeDisconnect } from './useDeviceConnection';
import { getActiveSessionId } from './useTrainingSessionPersistence';

const FINISH_STOP_COMMAND_TIMEOUT_MS = 2000;
const BIKE_SIGNAL_STALE_TIMEOUT_MS = 5000;

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
  const suppressDisconnectPauseRef = useRef(false);

  const phase = useTrainingSessionStore((s) => s.phase);
  const elapsedSeconds = useTrainingSessionStore((s) => s.elapsedSeconds);
  const totalDistance = useTrainingSessionStore((s) => s.totalDistance);
  const totalCalories = useTrainingSessionStore((s) => s.totalCalories);
  const currentMetrics = useTrainingSessionStore((s) => s.currentMetrics);
  const bikeAdapter = useDeviceConnectionStore((s) => s.bikeAdapter);
  const lastBikeSignalAtMs = useDeviceConnectionStore((s) => s.lastBikeSignalAtMs);

  const ensureEngineRunning = useCallback(() => {
    engineRef.current ??= new MetronomeEngine();
    engineRef.current.start();
  }, []);

  const stopEngine = useCallback((clearRef: boolean) => {
    engineRef.current?.stop();

    if (clearRef) {
      engineRef.current = null;
    }
  }, []);

  const freezeActiveSession = useCallback(() => {
    if (useTrainingSessionStore.getState().phase !== TrainingPhase.Active) {
      return;
    }

    useTrainingSessionStore.getState().pause();
    stopEngine(false);
  }, [stopEngine]);

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

    const currentBikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
    if (!currentBikeAdapter) {
      console.warn('[useTrainingSession] Cannot start session: bike not connected');
      return;
    }

    useTrainingSessionStore.getState().start();
    void currentBikeAdapter.setControlState(BikeStatus.Started);
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

    const currentBikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
    if (!currentBikeAdapter) {
      console.warn('[useTrainingSession] Cannot resume session: bike not connected');
      return;
    }

    useTrainingSessionStore.getState().resume();
    void currentBikeAdapter.setControlState(BikeStatus.Started);
    ensureEngineRunning();
  }, [ensureEngineRunning]);

  const finishSession = useCallback(() => {
    const currentBikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
    if (currentBikeAdapter) {
      pendingFinishStopRef.current = currentBikeAdapter.setControlState(BikeStatus.Stopped).catch((err: unknown) => {
        console.error('[useTrainingSession] Bike stop failed before disconnect:', err);
      });
    } else {
      pendingFinishStopRef.current = null;
    }

    useTrainingSessionStore.getState().finish();
    stopEngine(true);
  }, [stopEngine]);

  const resetSessionAndConnections = useCallback(async () => {
    suppressDisconnectPauseRef.current = true;

    try {
      await awaitPendingFinishStop();

      // Release FTMS control so the bike exits "APP" mode and clears its display metrics.
      // Queued after any pending Stop via the adapter's command queue.
      const adapter = useDeviceConnectionStore.getState().bikeAdapter;
      if (adapter) {
        try {
          await adapter.setControlState(BikeStatus.Reset);
        } catch (err: unknown) {
          console.error('[useTrainingSession] Bike reset failed before disconnect:', err);
        }
      }

      await disconnectAllDeviceConnections({ updateReconnectState: true, suppressAutoReconnect: true });
      useTrainingSessionStore.getState().reset();
    } finally {
      suppressDisconnectPauseRef.current = false;
    }
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

    await resetSessionAndConnections();

    return sessionId;
  }, [finishSession, resetSessionAndConnections]);

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
      } else if (
        (status === BikeStatus.Paused || status === BikeStatus.Stopped) &&
        currentPhase === TrainingPhase.Active
      ) {
        // Ignore when already Paused — a Stopped echo can come from our own setControlState(Stopped) call.
        // When Active, both Paused and Stopped should freeze the session until the user resumes or finishes.
        freezeActiveSession();
      }
    },
    [ensureEngineRunning, freezeActiveSession],
  );

  // ── Sync from Bike to App ──────────────────────────────
  const latestBikeStatus = useDeviceConnectionStore((s) => s.latestBikeMetrics?.status);

  useEffect(() => {
    if (!latestBikeStatus) return;
    syncFromBikeStatus(latestBikeStatus);
  }, [latestBikeStatus, syncFromBikeStatus]);

  useEffect(() => {
    if (phase !== TrainingPhase.Active) {
      return;
    }

    if (bikeAdapter !== null || suppressDisconnectPauseRef.current) {
      return;
    }

    freezeActiveSession();
    void handleUnexpectedBikeDisconnect();
  }, [bikeAdapter, freezeActiveSession, phase]);

  useEffect(() => {
    if (phase !== TrainingPhase.Active) {
      return;
    }

    if (bikeAdapter === null || lastBikeSignalAtMs === null || suppressDisconnectPauseRef.current) {
      return;
    }

    if (Date.now() - lastBikeSignalAtMs < BIKE_SIGNAL_STALE_TIMEOUT_MS) {
      return;
    }

    freezeActiveSession();
    void handleUnexpectedBikeDisconnect();
  }, [bikeAdapter, elapsedSeconds, freezeActiveSession, lastBikeSignalAtMs, phase]);

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
