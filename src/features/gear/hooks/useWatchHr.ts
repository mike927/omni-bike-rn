import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { WatchConnectivity } from 'watch-connectivity';
import { WatchHrAdapter } from '../../../services/watch/WatchHrAdapter';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import {
  loadWatchHrEnabled,
  setWatchHrEnabled as persistWatchHrEnabled,
} from '../../../services/preferences/appPreferencesStorage';

// Native `startWatchApp` rejects with this code when HealthKit cannot hand the
// configuration off to the Watch app (asleep, out of range, or still launching).
// Recovery is the reachability listener below, so suppress the log for this
// specific code to avoid a spurious error banner on the expected warm-up race.
const CODE_START_WATCH_APP_FAILED = 'ERR_START_WATCH_APP_FAILED';

function isExpectedReachabilityDelay(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === CODE_START_WATCH_APP_FAILED;
}

/**
 * Manages the Apple Watch HR source lifecycle.
 *
 * - Only active on iPhone (guarded by isAppleWatchAvailable).
 * - Persists the user's enable/disable preference.
 * - Connects the WatchHrAdapter when training becomes Active and the Watch is enabled.
 * - Disconnects on session finish, discard, or when the user disables Watch HR.
 * - Feeds incoming HR samples into deviceConnectionStore.updateAppleWatchHr().
 */
export function useWatchHr() {
  const watchAvailable = isAppleWatchAvailable(Platform.OS);
  const adapterRef = useRef<WatchHrAdapter | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const [watchHrEnabled, setWatchHrEnabled] = useState(false);

  const updateAppleWatchHr = useDeviceConnectionStore((s) => s.updateAppleWatchHr);
  const phase = useTrainingSessionStore((s) => s.phase);

  // Load persisted preference on mount
  useEffect(() => {
    if (!watchAvailable) return;
    void loadWatchHrEnabled().then((enabled) => {
      setWatchHrEnabled(enabled);
    });
  }, [watchAvailable]);

  // ── Connection helpers ───────────────────────────────────────────────────

  const startStream = useCallback(async () => {
    if (!watchAvailable) return;
    if (adapterRef.current) return; // already connected

    const adapter = new WatchHrAdapter();
    try {
      await adapter.connect();
    } catch (err) {
      // The Watch app often becomes reachable a moment after the ride starts.
      // That case is recovered by the reachability listener below, so avoid
      // surfacing a spurious error banner for the expected warm-up race.
      if (!isExpectedReachabilityDelay(err)) {
        console.error('[useWatchHr] Failed to connect Watch HR:', err);
      }
      return;
    }

    adapterRef.current = adapter;
    subRef.current = adapter.subscribeToHeartRate((hr) => {
      updateAppleWatchHr(hr);
    });
  }, [watchAvailable, updateAppleWatchHr]);

  const stopStream = useCallback(async () => {
    subRef.current?.remove();
    subRef.current = null;

    if (adapterRef.current) {
      try {
        await adapterRef.current.disconnect();
      } catch (err) {
        console.error('[useWatchHr] Failed to disconnect Watch HR:', err);
      }
      adapterRef.current = null;
    }

    updateAppleWatchHr(null);
  }, [updateAppleWatchHr]);

  // Keep a ref so the unmount-only effect below always sees the latest stopStream
  // without re-running cleanup on every identity change.
  const stopStreamRef = useRef(stopStream);
  useEffect(() => {
    stopStreamRef.current = stopStream;
  }, [stopStream]);

  // ── React to training phase transitions ─────────────────────────────────

  useEffect(() => {
    if (!watchAvailable) return;
    if (!watchHrEnabled) return;

    if (phase === TrainingPhase.Active) {
      void startStream();
    } else if (phase === TrainingPhase.Idle) {
      // Session finished or discarded — stop stream
      void stopStream();
    }
  }, [phase, startStream, stopStream, watchAvailable, watchHrEnabled]);

  // Unmount-only cleanup — scoped away from phase transitions so Active→Paused
  // does not tear down the Watch workout session.
  useEffect(() => {
    return () => {
      void stopStreamRef.current();
    };
  }, []);

  // ── Watch reachability updates (surface to store + retry) ───────────────

  useEffect(() => {
    if (!watchAvailable) return;

    const sub = WatchConnectivity.addListener('onReachabilityChange', ({ reachable }) => {
      if (!reachable) {
        // Watch went out of range — clear HR so MetronomeEngine falls back
        updateAppleWatchHr(null);
        return;
      }
      // Watch came back in range — if we're mid-session with HR enabled but no
      // active adapter, the initial connect was dropped. Retry now.
      if (watchHrEnabled && phase === TrainingPhase.Active && !adapterRef.current) {
        void startStream();
      }
    });
    return () => sub.remove();
  }, [watchAvailable, updateAppleWatchHr, watchHrEnabled, phase, startStream]);

  // ── Public API ───────────────────────────────────────────────────────────

  const enableWatchHr = useCallback(async () => {
    await persistWatchHrEnabled(true);
    setWatchHrEnabled(true);
    if (phase === TrainingPhase.Active) {
      await startStream();
    }
  }, [phase, startStream]);

  const disableWatchHr = useCallback(async () => {
    await persistWatchHrEnabled(false);
    setWatchHrEnabled(false);
    await stopStream();
  }, [stopStream]);

  return {
    watchAvailable,
    watchHrEnabled,
    enableWatchHr,
    disableWatchHr,
  };
}
