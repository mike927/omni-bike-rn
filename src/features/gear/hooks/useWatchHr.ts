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

/**
 * Grace window before a dropped Watch link reads as `unavailable`. `isReachable`
 * blips briefly when the Watch screen dims even though the app is still open, so a
 * momentary drop is debounced; only a sustained drop (app closed/suspended) resolves
 * to `unavailable`.
 */
export const WATCH_REACHABILITY_GRACE_MS = 5000;

/**
 * Root-only hook that owns the Apple Watch HR lifecycle.
 *
 * Tracks the Watch as one of three availabilities:
 *   unavailable — Watch app is not running (closed or suspended)
 *   idle        — Watch app is running/reachable, no workout
 *   in_progress — workout running (HR streams to iPhone)
 *
 * Reachability drives `unavailable` ⇄ `idle`, debounced by WATCH_REACHABILITY_GRACE_MS
 * so a dimmed-screen blip doesn't flap to `unavailable`. Companion presence (paired +
 * installed) only gates whether the Watch is a candidate: `available: false` forces
 * `unavailable`, but it never promotes to `idle` — "installed" is not "running".
 * Session `started`/`ended`/`failed` events drive `in_progress`; `failed` collapses to
 * `idle`. An active workout is never downgraded.
 *
 * Mount exactly once, at the root layout.
 */
export function useWatchHr(): void {
  const watchAvailable = isAppleWatchAvailable(Platform.OS);
  const adapterRef = useRef<WatchHrAdapter | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const kcalSubRef = useRef<{ remove: () => void } | null>(null);
  const latestStartRequestAtRef = useRef(0);
  const streamGenerationRef = useRef(0);
  // Synchronous guard against re-entrant startStream invocations. `adapterRef`
  // is only assigned after `await adapter.connect()` resolves, so without this
  // ref a second caller (e.g. the reachability listener firing during the
  // connect's await window) would pass the adapter-null check and race in a
  // parallel connect — causing an activate/startWatchApp feedback loop.
  const startingRef = useRef(false);

  const updateAppleWatchHr = useDeviceConnectionStore((s) => s.updateAppleWatchHr);
  const updateAppleWatchActiveKcal = useDeviceConnectionStore((s) => s.updateAppleWatchActiveKcal);
  const setWatchAvailability = useDeviceConnectionStore((s) => s.setWatchAvailability);
  const phase = useTrainingSessionStore((s) => s.phase);
  const watchHrEnabled = useWatchHrStore((s) => s.enabled);
  const hydrateWatchHrPref = useWatchHrStore((s) => s.hydrate);

  useEffect(() => {
    if (!watchAvailable) return;
    void hydrateWatchHrPref();
  }, [watchAvailable, hydrateWatchHrPref]);

  const startStream = useCallback(async () => {
    if (!watchAvailable) return;
    if (adapterRef.current || startingRef.current) return;

    const streamGeneration = streamGenerationRef.current + 1;
    streamGenerationRef.current = streamGeneration;
    startingRef.current = true;
    latestStartRequestAtRef.current = Date.now();
    const adapter = new WatchHrAdapter();
    try {
      await adapter.connect();
    } catch (err) {
      startingRef.current = false;
      const startWasSuperseded =
        streamGeneration !== streamGenerationRef.current ||
        phaseRef.current !== TrainingPhase.Active ||
        !watchHrEnabledRef.current;
      if (startWasSuperseded) return;
      console.error('[useWatchHr] Failed to connect Watch HR:', err);
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
      if (phaseRef.current === TrainingPhase.Active && watchHrEnabledRef.current) {
        setWatchAvailability('in_progress');
      }
    });
    kcalSubRef.current = adapter.subscribeToActiveKcal((kcal) => {
      updateAppleWatchActiveKcal(kcal);
    });
  }, [setWatchAvailability, watchAvailable, updateAppleWatchHr, updateAppleWatchActiveKcal]);

  const stopStream = useCallback(async () => {
    const hadStream =
      adapterRef.current !== null || subRef.current !== null || kcalSubRef.current !== null || startingRef.current;
    streamGenerationRef.current += 1;
    if (!hadStream) return;

    subRef.current?.remove();
    subRef.current = null;
    kcalSubRef.current?.remove();
    kcalSubRef.current = null;

    if (adapterRef.current) {
      try {
        await adapterRef.current.disconnect();
      } catch (err) {
        console.error('[useWatchHr] Failed to disconnect Watch HR:', err);
      }
      adapterRef.current = null;
    }

    updateAppleWatchHr(null);
    updateAppleWatchActiveKcal(null);
  }, [updateAppleWatchHr, updateAppleWatchActiveKcal]);

  // Refs shadow current values so the listener effect below stays mount-only.
  // Re-registering would trigger thousands of redundant `activate()` calls.
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

  useEffect(() => {
    if (!watchAvailable) return;

    if (phase === TrainingPhase.Active && watchHrEnabled) {
      void startStream();
    } else if (phase === TrainingPhase.Finished && watchHrEnabled) {
      void stopStream();
    } else if (phase === TrainingPhase.Idle || !watchHrEnabled) {
      void stopStream();
    }
  }, [phase, watchHrEnabled, startStream, stopStream, watchAvailable]);

  // Unmount-only cleanup, scoped away from phase transitions so Active→Paused
  // does not tear down the Watch workout session.
  useEffect(() => {
    return () => {
      void stopStreamRef.current();
    };
  }, []);

  useEffect(() => {
    if (!watchAvailable) return;

    // A momentary reachability drop (Watch screen dimming) must not flap to
    // `unavailable`; only a sustained drop should. Debounce the downgrade.
    let unavailableTimer: ReturnType<typeof setTimeout> | null = null;
    const clearUnavailableTimer = () => {
      if (unavailableTimer) {
        clearTimeout(unavailableTimer);
        unavailableTimer = null;
      }
    };
    const markUnavailable = () => {
      setWatchAvailability('unavailable');
      updateAppleWatchHr(null);
      updateAppleWatchActiveKcal(null);
    };

    // Companion presence (paired + app installed) only gates whether the Watch is a
    // candidate. `available: false` (unpaired / uninstalled) is definitive — the Watch
    // is gone. It never promotes to `idle`: "installed" is not "running", so a closed
    // companion app must not read as ready. Reachability owns `unavailable` ⇄ `idle`.
    const companionStateSub = WatchConnectivity.addListener(
      'onWatchCompanionStateChange',
      ({ available }: { available: boolean }) => {
        if (!available) {
          clearUnavailableTimer();
          markUnavailable();
        }
      },
    );

    // Reachability is the live "Watch app is running" signal: true only while the app
    // is foreground/active or in an extended-runtime workout. true → `idle`; a
    // sustained false → `unavailable` after the grace window. An in-progress workout
    // is never downgraded (extended runtime keeps it reachable). It also retries the HR
    // stream once the link returns mid-ride.
    const reachabilitySub = WatchConnectivity.addListener('onReachabilityChange', ({ reachable }) => {
      if (reachable) {
        clearUnavailableTimer();
        if (useDeviceConnectionStore.getState().watchAvailability !== 'in_progress') {
          setWatchAvailability('idle');
        }
        if (
          watchHrEnabledRef.current &&
          phaseRef.current === TrainingPhase.Active &&
          !adapterRef.current &&
          !startingRef.current
        ) {
          void startStreamRef.current();
        }
        return;
      }
      if (useDeviceConnectionStore.getState().watchAvailability === 'in_progress') return;
      clearUnavailableTimer();
      unavailableTimer = setTimeout(() => {
        unavailableTimer = null;
        if (useDeviceConnectionStore.getState().watchAvailability !== 'in_progress') {
          markUnavailable();
        }
      }, WATCH_REACHABILITY_GRACE_MS);
    });

    const sessionStateSub = WatchConnectivity.addListener(
      'onWatchSessionState',
      ({ state, sentAtMs }: { state: WatchSessionStateEvent; sentAtMs: number }) => {
        if (sentAtMs < latestStartRequestAtRef.current) return;
        clearUnavailableTimer();
        setWatchAvailability(state === 'started' ? 'in_progress' : 'idle');
      },
    );

    void WatchConnectivity.activate().catch((error: unknown) => {
      console.error('[useWatchHr] Failed to activate WatchConnectivity:', error);
    });

    return () => {
      clearUnavailableTimer();
      companionStateSub.remove();
      reachabilitySub.remove();
      sessionStateSub.remove();
    };
  }, [watchAvailable, updateAppleWatchHr, updateAppleWatchActiveKcal, setWatchAvailability]);
}
