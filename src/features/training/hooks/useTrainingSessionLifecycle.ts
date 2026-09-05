import { useEffect } from 'react';

import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import {
  freezeActiveSession,
  isDisconnectPauseSuppressed,
  stopSessionEngine,
  syncSessionEngineToPhase,
  syncSessionFromBikeStatus,
} from '../sessionController';
import { handleUnexpectedBikeDisconnect } from './useDeviceConnection';

const BIKE_SIGNAL_STALE_TIMEOUT_MS = 5000;

/**
 * Root-only hook that owns the training session lifecycle.
 *
 * Mounted exactly once, from `useAppInitialization`, so the ride has a single
 * owner that outlives every screen. Screens mount `useTrainingSession`, which
 * only reads state and issues commands: a screen being pushed, popped or
 * revisited can therefore neither stop a running ride nor add a second clock.
 *
 * Responsibilities, all of them global:
 *  - keep exactly one recording clock in sync with the session phase;
 *  - mirror bike-reported status onto the session;
 *  - freeze a running ride when the bike disconnects or goes silent.
 */
export function useTrainingSessionLifecycle(): void {
  const phase = useTrainingSessionStore((s) => s.phase);
  const elapsedSeconds = useTrainingSessionStore((s) => s.elapsedSeconds);
  const bikeAdapter = useDeviceConnectionStore((s) => s.bikeAdapter);
  const lastBikeSignalAtMs = useDeviceConnectionStore((s) => s.lastBikeSignalAtMs);
  const latestBikeStatus = useDeviceConnectionStore((s) => s.latestBikeMetrics?.status);

  // ── The one recording clock ───────────────────────────
  useEffect(() => {
    syncSessionEngineToPhase(phase);
  }, [phase]);

  // Teardown belongs to the root, not to a phase change: only the app tree
  // going away stops a ride that is still Active.
  useEffect(
    () => () => {
      stopSessionEngine();
    },
    [],
  );

  // ── Sync from bike to app ─────────────────────────────
  useEffect(() => {
    if (!latestBikeStatus) {
      return;
    }
    syncSessionFromBikeStatus(latestBikeStatus);
  }, [latestBikeStatus]);

  useEffect(() => {
    if (phase !== TrainingPhase.Active) {
      return;
    }

    if (bikeAdapter !== null || isDisconnectPauseSuppressed()) {
      return;
    }

    freezeActiveSession();
    void handleUnexpectedBikeDisconnect();
  }, [bikeAdapter, phase]);

  useEffect(() => {
    if (phase !== TrainingPhase.Active) {
      return;
    }

    if (bikeAdapter === null || lastBikeSignalAtMs === null || isDisconnectPauseSuppressed()) {
      return;
    }

    if (Date.now() - lastBikeSignalAtMs < BIKE_SIGNAL_STALE_TIMEOUT_MS) {
      return;
    }

    freezeActiveSession();
    void handleUnexpectedBikeDisconnect();
  }, [bikeAdapter, elapsedSeconds, lastBikeSignalAtMs, phase]);
}
