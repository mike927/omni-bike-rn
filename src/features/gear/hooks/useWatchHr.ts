import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { WatchConnectivity } from 'watch-connectivity';
import { WatchHrAdapter } from '../../../services/watch/WatchHrAdapter';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import { loadWatchHrEnabled, setWatchHrEnabled } from '../../../services/preferences/appPreferencesStorage';

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
  const [watchHrEnabled, setWatchHrEnabledState] = useState(false);

  const updateAppleWatchHr = useDeviceConnectionStore((s) => s.updateAppleWatchHr);
  const phase = useTrainingSessionStore((s) => s.phase);

  // Load persisted preference on mount
  useEffect(() => {
    if (!watchAvailable) return;
    void loadWatchHrEnabled().then((enabled) => {
      setWatchHrEnabledState(enabled);
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
      console.error('[useWatchHr] Failed to connect Watch HR:', err);
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

  // ── React to training phase transitions ─────────────────────────────────

  useEffect(() => {
    if (!watchAvailable) return;

    let mounted = true;

    void loadWatchHrEnabled().then((enabled) => {
      if (!mounted || !enabled) return;

      if (phase === TrainingPhase.Active) {
        void startStream();
      } else if (phase === TrainingPhase.Idle) {
        // Session finished or discarded — stop stream
        void stopStream();
      }
    });

    return () => {
      mounted = false;
      // Cleanup on unmount
      void stopStream();
    };
  }, [phase, startStream, stopStream, watchAvailable]);

  // ── Watch reachability updates (surface to store) ───────────────────────

  useEffect(() => {
    if (!watchAvailable) return;

    const sub = WatchConnectivity.addListener('onReachabilityChange', ({ reachable }) => {
      if (!reachable) {
        // Watch went out of range — clear HR so MetronomeEngine falls back
        updateAppleWatchHr(null);
      }
    });
    return () => sub.remove();
  }, [watchAvailable, updateAppleWatchHr]);

  // ── Public API ───────────────────────────────────────────────────────────

  const enableWatchHr = useCallback(async () => {
    await setWatchHrEnabled(true);
    setWatchHrEnabledState(true);
    if (phase === TrainingPhase.Active) {
      await startStream();
    }
  }, [phase, startStream]);

  const disableWatchHr = useCallback(async () => {
    await setWatchHrEnabled(false);
    setWatchHrEnabledState(false);
    await stopStream();
  }, [stopStream]);

  return {
    watchAvailable,
    watchHrEnabled,
    enableWatchHr,
    disableWatchHr,
  };
}
