import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { WatchConnectivity } from 'watch-connectivity';
import { WatchHrAdapter } from '../../../services/watch/WatchHrAdapter';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { useWatchHrStore } from '../../../store/watchHrStore';
import { TrainingPhase } from '../../../types/training';
import type { WatchSessionStateEvent } from '../../../types/watch';

// Native `startWatchApp` rejects with this code when HealthKit cannot hand the
// configuration off to the Watch app (asleep, out of range, or still launching).
// Recovery is the reachability listener below, so suppress the log for this
// specific code to avoid a spurious error banner on the expected warm-up race.
const CODE_START_WATCH_APP_FAILED = 'ERR_START_WATCH_APP_FAILED';
const WATCH_START_TIMEOUT_MS = 10_000;

function isExpectedReachabilityDelay(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === CODE_START_WATCH_APP_FAILED;
}

/**
 * Root-only hook that owns the Apple Watch HR lifecycle.
 *
 * - Only active on iPhone (guarded by isAppleWatchAvailable).
 * - Hydrates the persisted enable/disable preference on mount.
 * - Connects the WatchHrAdapter when training becomes Active and the Watch is enabled.
 * - Disconnects on session finish, discard, or when the user disables Watch HR.
 * - Feeds incoming HR samples into deviceConnectionStore.updateAppleWatchHr().
 *
 * Mount exactly once, at the root layout. UI consumers that only need to read
 * or toggle the preference use `useWatchHrControls` instead.
 */
export function useWatchHr(): void {
  const watchAvailable = isAppleWatchAvailable(Platform.OS);
  const adapterRef = useRef<WatchHrAdapter | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const latestStartRequestAtRef = useRef(0);
  const streamGenerationRef = useRef(0);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard against re-entrant startStream invocations. `adapterRef`
  // is only assigned after `await adapter.connect()` resolves, so without this
  // ref a second caller (e.g. the reachability listener firing during the
  // connect's await window) would pass the adapter-null check and race in a
  // parallel connect — causing an activate/startWatchApp feedback loop.
  const startingRef = useRef(false);

  const updateAppleWatchHr = useDeviceConnectionStore((s) => s.updateAppleWatchHr);
  const setWatchReachable = useDeviceConnectionStore((s) => s.setWatchReachable);
  const setWatchSessionState = useDeviceConnectionStore((s) => s.setWatchSessionState);
  const phase = useTrainingSessionStore((s) => s.phase);
  const watchHrEnabled = useWatchHrStore((s) => s.enabled);
  const hydrateWatchHrPref = useWatchHrStore((s) => s.hydrate);

  // Load persisted preference on mount
  useEffect(() => {
    if (!watchAvailable) return;
    void hydrateWatchHrPref();
  }, [watchAvailable, hydrateWatchHrPref]);

  // ── Connection helpers ───────────────────────────────────────────────────

  const clearStartTimeout = useCallback(() => {
    if (startTimeoutRef.current === null) return;
    clearTimeout(startTimeoutRef.current);
    startTimeoutRef.current = null;
  }, []);

  const scheduleStartTimeout = useCallback(() => {
    clearStartTimeout();
    startTimeoutRef.current = setTimeout(() => {
      const { watchSessionState } = useDeviceConnectionStore.getState();
      const { phase: currentPhase } = useTrainingSessionStore.getState();
      const { enabled } = useWatchHrStore.getState();

      if (watchSessionState !== 'starting') return;
      if (currentPhase !== TrainingPhase.Active || !enabled) return;

      setWatchSessionState('failed');
      updateAppleWatchHr(null);
    }, WATCH_START_TIMEOUT_MS);
  }, [clearStartTimeout, setWatchSessionState, updateAppleWatchHr]);

  const startStream = useCallback(async () => {
    if (!watchAvailable) return;
    if (adapterRef.current || startingRef.current) return;

    const streamGeneration = streamGenerationRef.current + 1;
    streamGenerationRef.current = streamGeneration;
    startingRef.current = true;
    latestStartRequestAtRef.current = Date.now();
    setWatchSessionState('starting');
    scheduleStartTimeout();
    const adapter = new WatchHrAdapter();
    try {
      await adapter.connect();
    } catch (err) {
      startingRef.current = false;
      const startWasSuperseded =
        streamGeneration !== streamGenerationRef.current ||
        phaseRef.current !== TrainingPhase.Active ||
        !watchHrEnabledRef.current;
      if (startWasSuperseded) {
        return;
      }
      // The Watch app often becomes reachable a moment after the ride starts.
      // That case is recovered by the reachability listener below, so avoid
      // surfacing a spurious error banner for the expected warm-up race.
      if (!isExpectedReachabilityDelay(err)) {
        clearStartTimeout();
        setWatchSessionState('failed');
        console.error('[useWatchHr] Failed to connect Watch HR:', err);
      }
      return;
    }

    const startWasSuperseded =
      streamGeneration !== streamGenerationRef.current ||
      phaseRef.current !== TrainingPhase.Active ||
      !watchHrEnabledRef.current;
    if (startWasSuperseded) {
      startingRef.current = false;
      try {
        await adapter.disconnect();
      } catch (err) {
        console.error('[useWatchHr] Failed to cancel Watch HR start:', err);
      }
      return;
    }

    adapterRef.current = adapter;
    startingRef.current = false;
    subRef.current = adapter.subscribeToHeartRate((hr) => {
      updateAppleWatchHr(hr);
    });
  }, [watchAvailable, updateAppleWatchHr, setWatchSessionState, scheduleStartTimeout, clearStartTimeout]);

  const stopStream = useCallback(async () => {
    const hadStream = adapterRef.current !== null || subRef.current !== null || startingRef.current;
    streamGenerationRef.current += 1;
    clearStartTimeout();
    if (!hadStream) return;

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
  }, [updateAppleWatchHr, clearStartTimeout]);

  // Refs shadow the current values so the mount-only listener effect below can
  // read them without re-registering the native listeners on every phase or
  // preference change. Re-registering that effect is what used to trigger
  // thousands of redundant `WatchConnectivity.activate()` calls per second.
  const phaseRef = useRef(phase);
  const watchHrEnabledRef = useRef(watchHrEnabled);
  const startStreamRef = useRef(startStream);
  const stopStreamRef = useRef(stopStream);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    watchHrEnabledRef.current = watchHrEnabled;
  }, [watchHrEnabled]);
  useEffect(() => {
    startStreamRef.current = startStream;
  }, [startStream]);
  useEffect(() => {
    stopStreamRef.current = stopStream;
  }, [stopStream]);

  // ── React to training phase + preference transitions ────────────────────

  useEffect(() => {
    if (!watchAvailable) return;

    if (phase === TrainingPhase.Active && watchHrEnabled) {
      void startStream();
    } else if (phase === TrainingPhase.Finished && watchHrEnabled) {
      clearStartTimeout();
      setWatchSessionState('stopping');
      void stopStream();
    } else if (phase === TrainingPhase.Idle || !watchHrEnabled) {
      clearStartTimeout();
      setWatchSessionState('idle');
      void stopStream();
    }
  }, [phase, watchHrEnabled, startStream, stopStream, watchAvailable, setWatchSessionState, clearStartTimeout]);

  // Unmount-only cleanup — scoped away from phase transitions so Active→Paused
  // does not tear down the Watch workout session.
  useEffect(() => {
    return () => {
      void stopStreamRef.current();
    };
  }, []);

  // ── Watch reachability + session state listeners (mount-only) ───────────
  //
  // This effect registers native listeners and activates the WC session
  // exactly once per mount. Callbacks read the latest phase/enabled via refs
  // so the effect does not tear down and re-subscribe on every state change,
  // which would otherwise trigger an activate() loop.

  useEffect(() => {
    if (!watchAvailable) return;

    const reachabilitySub = WatchConnectivity.addListener('onReachabilityChange', ({ reachable }) => {
      setWatchReachable(reachable);
      if (!reachable) {
        // Watch went out of range — clear HR so MetronomeEngine falls back
        updateAppleWatchHr(null);
        return;
      }
      // Watch came back in range — if we're mid-session with HR enabled but no
      // active adapter, the initial connect was dropped. Retry now.
      if (
        watchHrEnabledRef.current &&
        phaseRef.current === TrainingPhase.Active &&
        !adapterRef.current &&
        !startingRef.current
      ) {
        void startStreamRef.current();
      }
    });

    const sessionStateSub = WatchConnectivity.addListener(
      'onWatchSessionState',
      ({ state, sentAtMs }: { state: WatchSessionStateEvent; sentAtMs: number }) => {
        if (sentAtMs < latestStartRequestAtRef.current) {
          return;
        }

        if (state === 'started') {
          if (phaseRef.current !== TrainingPhase.Active || !watchHrEnabledRef.current) return;
          clearStartTimeout();
          setWatchSessionState('active');
        } else if (state === 'ended') {
          if (phaseRef.current !== TrainingPhase.Finished) return;
          clearStartTimeout();
          setWatchSessionState('ended');
        } else if (state === 'failed') {
          if (phaseRef.current !== TrainingPhase.Active || !watchHrEnabledRef.current) return;
          clearStartTimeout();
          setWatchSessionState('failed');
        }
      },
    );

    // Activate WCSession after listeners are registered so the initial
    // reachability snapshot is not missed on app launch or screen revisit.
    void WatchConnectivity.activate().catch((error: unknown) => {
      console.error('[useWatchHr] Failed to activate WatchConnectivity:', error);
    });

    return () => {
      clearStartTimeout();
      reachabilitySub.remove();
      sessionStateSub.remove();
    };
  }, [watchAvailable, updateAppleWatchHr, setWatchReachable, setWatchSessionState, clearStartTimeout]);
}
