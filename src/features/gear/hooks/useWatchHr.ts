import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { WatchConnectivity } from 'watch-connectivity';
import { WatchHrAdapter } from '../../../services/watch/WatchHrAdapter';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import type { WatchAvailability, WatchSessionStateEvent } from '../../../types/watch';

// Dev-only tracing of the Watch↔iPhone link — every WC event arrival and every
// availability transition (with its cause) — surfaced to Metro. This connection is
// flaky in the field, so making the flow observable is worth the lines. `console.warn`
// is lint-allowed; gated on __DEV__ so nothing ships to production logs.
function logWc(message: string): void {
  if (__DEV__) {
    console.warn(`[WC-JS] ${message}`);
  }
}

/**
 * Root-only hook that owns the Apple Watch HR lifecycle.
 *
 * Tracks the Watch as one of three availabilities:
 *   unavailable — Watch not paired or Watch app not installed
 *   idle        — Watch paired + app installed, no workout active
 *   in_progress — workout running (HR streams to iPhone)
 *
 * Companion presence (paired + app installed via `onWatchCompanionStateChange`) drives
 * `unavailable` ⇄ `idle`: `available: true` → `idle` (if not `in_progress`);
 * `available: false` → `unavailable` (and clears HR + kcal). Reachability
 * (`onReachabilityChange`) is transient — it drops when the Watch screen dims — so it
 * must NOT change the availability label. It is only used as a mid-ride stream-retry
 * trigger: if the Watch becomes reachable while Active + watch-primary and no adapter
 * is connected, `startStream` is retried.
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
  const setActiveHrSource = useDeviceConnectionStore((s) => s.setActiveHrSource);
  const phase = useTrainingSessionStore((s) => s.phase);
  const primary = useHrSourceStore((s) => s.primary);
  const hydrateHrSourcePref = useHrSourceStore((s) => s.hydrate);

  // Hydrate primary source unconditionally — non-watch primaries (bluetooth, bike) also
  // need to be known at workout start so the lock is correct on all platforms/configs.
  // Tolerates a pre-hydration `null` primary: no watch stream starts until `primary`
  // resolves; the reachability-retry path recovers it if the Watch becomes reachable later.
  useEffect(() => {
    void hydrateHrSourcePref();
  }, [hydrateHrSourcePref]);

  // Session-level HR source lock — platform-independent, NOT gated on watch availability.
  // Tracks `primary` while Active (consistent with the live `primary === 'watch'` watch gate):
  // a mid-workout primary change retargets the locked source. Cleared when not training.
  useEffect(() => {
    if (phase === TrainingPhase.Active) {
      setActiveHrSource(primary);
    } else if (phase === TrainingPhase.Idle || phase === TrainingPhase.Finished) {
      setActiveHrSource(null);
    }
    // Paused: leave the lock intact.
  }, [phase, primary, setActiveHrSource]);

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
        primaryRef.current !== 'watch';
      if (startWasSuperseded) return;
      console.error('[useWatchHr] Failed to connect Watch HR:', err);
      return;
    }

    const startWasSuperseded =
      streamGeneration !== streamGenerationRef.current ||
      phaseRef.current !== TrainingPhase.Active ||
      primaryRef.current !== 'watch';
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
      if (phaseRef.current === TrainingPhase.Active && primaryRef.current === 'watch') {
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
  const primaryRef = useRef(primary);
  const startStreamRef = useRef(startStream);
  const stopStreamRef = useRef(stopStream);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    primaryRef.current = primary;
  }, [primary]);
  useEffect(() => {
    startStreamRef.current = startStream;
  }, [startStream]);
  useEffect(() => {
    stopStreamRef.current = stopStream;
  }, [stopStream]);

  // Tracks the phase the previous run saw, so a resume (Paused→Active) is told apart
  // from a fresh start (Idle→Active) and the right pause/resume command is emitted.
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (!watchAvailable) return;
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === TrainingPhase.Active) {
      if (primary === 'watch') {
        void startStream();
        if (prevPhase === TrainingPhase.Paused) {
          // Resuming: the stream is still connected; tell the Watch to resume its session.
          void WatchConnectivity.resumeMirroredWorkout().catch((error: unknown) => {
            console.error('[useWatchHr] Failed to resume Watch workout:', error);
          });
        }
      } else {
        // primary changed away from watch while session is active: tear down watch stream.
        void stopStream();
      }
    } else if (phase === TrainingPhase.Paused && primary === 'watch') {
      // Keep the stream alive but pause the Watch session so its workout timer and HR
      // collection stop in sync with the iPhone (the Watch owns the HKWorkoutSession).
      void WatchConnectivity.pauseMirroredWorkout().catch((error: unknown) => {
        console.error('[useWatchHr] Failed to pause Watch workout:', error);
      });
    } else if (phase === TrainingPhase.Finished) {
      if (primary === 'watch') {
        void stopStream();
      }
    } else if (phase === TrainingPhase.Idle) {
      void stopStream();
    }
  }, [phase, primary, startStream, stopStream, watchAvailable]);

  // Unmount-only cleanup, scoped away from phase transitions so Active→Paused
  // does not tear down the Watch workout session.
  useEffect(() => {
    return () => {
      void stopStreamRef.current();
    };
  }, []);

  useEffect(() => {
    if (!watchAvailable) return;

    // Single funnel for availability writes so every transition is traced with its cause.
    const setAvailability = (next: WatchAvailability, reason: string) => {
      const prev = useDeviceConnectionStore.getState().watchAvailability;
      if (prev !== next) {
        logWc(`availability ${prev} -> ${next} (${reason})`);
      }
      setWatchAvailability(next);
    };

    // Companion presence (paired + app installed) drives `unavailable` ⇄ `idle`.
    // `available: true` → `idle` (unless a workout is already `in_progress`).
    // `available: false` (unpaired / uninstalled) → `unavailable`, and clear HR + kcal.
    const companionStateSub = WatchConnectivity.addListener(
      'onWatchCompanionStateChange',
      ({ available }: { available: boolean }) => {
        logWc(`event companion available=${available}`);
        if (available) {
          if (useDeviceConnectionStore.getState().watchAvailability !== 'in_progress') {
            setAvailability('idle', 'companion paired+installed');
          }
        } else {
          setAvailability('unavailable', 'companion unpaired/uninstalled');
          updateAppleWatchHr(null);
          updateAppleWatchActiveKcal(null);
        }
      },
    );

    // Reachability is transient (drops when the Watch screen dims) and MUST NOT change
    // the availability label. Its only job here is to retry the HR stream mid-ride if
    // the adapter was lost while the session is active.
    const reachabilitySub = WatchConnectivity.addListener('onReachabilityChange', ({ reachable }) => {
      logWc(`event reachability reachable=${reachable}`);
      if (
        reachable &&
        primaryRef.current === 'watch' &&
        phaseRef.current === TrainingPhase.Active &&
        !adapterRef.current &&
        !startingRef.current
      ) {
        logWc('reachable mid-ride — retrying HR stream');
        void startStreamRef.current();
      }
    });

    const sessionStateSub = WatchConnectivity.addListener(
      'onWatchSessionState',
      ({ state, sentAtMs }: { state: WatchSessionStateEvent; sentAtMs: number }) => {
        logWc(`event session state=${state} sentAtMs=${sentAtMs} latestStart=${latestStartRequestAtRef.current}`);
        if (sentAtMs < latestStartRequestAtRef.current) {
          logWc('session event ignored (stale — predates current start request)');
          return;
        }
        setAvailability(state === 'started' ? 'in_progress' : 'idle', `session ${state}`);
      },
    );

    logWc('activating WatchConnectivity');
    void WatchConnectivity.activate().catch((error: unknown) => {
      console.error('[useWatchHr] Failed to activate WatchConnectivity:', error);
    });

    return () => {
      companionStateSub.remove();
      reachabilitySub.remove();
      sessionStateSub.remove();
    };
  }, [watchAvailable, updateAppleWatchHr, updateAppleWatchActiveKcal, setWatchAvailability]);
}
