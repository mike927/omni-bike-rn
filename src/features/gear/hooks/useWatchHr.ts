import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { WatchConnectivity } from 'watch-connectivity';
import { WatchHrAdapter } from '../../../services/watch/WatchHrAdapter';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import {
  resolveWatchAvailability,
  WATCH_IDLE_GRACE_MS,
  WATCH_WORKOUT_GRACE_MS,
} from '../../../services/watch/watchAvailability';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import type { WatchSessionStateEvent } from '../../../types/watch';
import { logWc } from '../../../services/watch/wcLog';

/**
 * Root-only hook that owns the Apple Watch HR lifecycle.
 *
 * Tracks the Watch with a two-state, contact-based availability model:
 *   connected   — Watch is reachable, OR in an active workout within the grace window,
 *                 OR contacted within the idle grace window.
 *   unavailable — no recent contact and not reachable.
 *
 * Contact signals: reachability=true, session state events, HR samples, watch app-state
 * events. Companion events are logging-only.
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

  // Contact tracker state
  const isReachableRef = useRef(false);
  const workoutActiveRef = useRef(false);
  const lastContactAtMsRef = useRef<number | null>(null);

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

  // Trace the iPhone app's own foreground/background transitions to correlate with
  // Watch WC events when debugging.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      logWc(`iPhone appState -> ${state}`);
    });
    return () => sub.remove();
  }, []);

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
    logWc(`startStream: connecting (gen=${streamGeneration})`);
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
      logWc('startStream: superseded after connect — disconnecting');
      try {
        await adapter.disconnect();
      } catch (err) {
        console.error('[useWatchHr] Failed to cancel Watch HR start:', err);
      }
      return;
    }

    adapterRef.current = adapter;
    startingRef.current = false;
    logWc('startStream: connected — HR stream live');
    subRef.current = adapter.subscribeToHeartRate((hr) => {
      updateAppleWatchHr(hr);
      markContactRef.current();
    });
    kcalSubRef.current = adapter.subscribeToActiveKcal((kcal) => {
      updateAppleWatchActiveKcal(kcal);
    });
  }, [watchAvailable, updateAppleWatchHr, updateAppleWatchActiveKcal]);

  const stopStream = useCallback(async () => {
    const hadStream =
      adapterRef.current !== null || subRef.current !== null || kcalSubRef.current !== null || startingRef.current;
    streamGenerationRef.current += 1;
    if (!hadStream) return;
    logWc('stopStream: tearing down Watch HR stream');

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

  // markContact needs to be stable and accessible from inside startStream's subscription
  // callback, so it lives in a ref updated by the WC listener effect.
  // The no-op default is safe: markContact is assigned synchronously inside the mount-only
  // WC listener effect, which runs before any HR-subscription callback (those only fire
  // after `await adapter.connect()` resolves); the no-op just guards the impossible-early-call case.
  const markContactRef = useRef<() => void>(() => {});

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
          logWc('phase Paused→Active — sending resumeMirroredWorkout');
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
      logWc('phase Active→Paused — sending pauseMirroredWorkout');
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

    let availabilityTimer: ReturnType<typeof setTimeout> | null = null;
    const clearAvailabilityTimer = () => {
      if (availabilityTimer) {
        clearTimeout(availabilityTimer);
        availabilityTimer = null;
      }
    };

    const recomputeAvailability = () => {
      const next = resolveWatchAvailability({
        isReachable: isReachableRef.current,
        workoutActive: workoutActiveRef.current,
        lastContactAtMs: lastContactAtMsRef.current,
        nowMs: Date.now(),
      });
      const prev = useDeviceConnectionStore.getState().watchAvailability;
      if (prev !== next) logWc(`availability ${prev} -> ${next}`);
      setWatchAvailability(next);
    };

    const graceMs = () => (workoutActiveRef.current ? WATCH_WORKOUT_GRACE_MS : WATCH_IDLE_GRACE_MS);

    const armGraceTimer = () => {
      clearAvailabilityTimer();
      availabilityTimer = setTimeout(recomputeAvailability, graceMs() + 100);
    };

    // A signal received FROM the watch = contact. Refresh stamp, recompute, re-arm grace.
    const markContact = () => {
      lastContactAtMsRef.current = Date.now();
      recomputeAvailability();
      armGraceTimer();
    };
    markContactRef.current = markContact;

    // Companion presence: logging only. Does NOT set availability.
    const companionStateSub = WatchConnectivity.addListener(
      'onWatchCompanionStateChange',
      ({
        available,
        paired,
        installed,
        activationState,
        reachable,
      }: {
        available: boolean;
        paired?: boolean;
        installed?: boolean;
        activationState?: number;
        reachable?: boolean;
      }) => {
        logWc(
          `event companion available=${available} paired=${paired} installed=${installed} activationState=${activationState} reachable=${reachable}`,
        );
      },
    );

    // Reachability drives both availability and the mid-ride stream-retry.
    const reachabilitySub = WatchConnectivity.addListener(
      'onReachabilityChange',
      ({
        reachable,
        activationState,
        paired,
        installed,
      }: {
        reachable: boolean;
        activationState?: number;
        paired?: boolean;
        installed?: boolean;
      }) => {
        logWc(
          `event reachability reachable=${reachable} activationState=${activationState} paired=${paired} installed=${installed}`,
        );
        isReachableRef.current = reachable;
        if (reachable) {
          markContact();
        } else {
          recomputeAvailability();
          armGraceTimer();
        }
        // Mid-ride stream-retry when the Watch becomes reachable again.
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
      },
    );

    const sessionStateSub = WatchConnectivity.addListener(
      'onWatchSessionState',
      ({ state, sentAtMs }: { state: WatchSessionStateEvent; sentAtMs: number }) => {
        logWc(`event session state=${state} sentAtMs=${sentAtMs} latestStart=${latestStartRequestAtRef.current}`);
        if (sentAtMs < latestStartRequestAtRef.current) {
          logWc('session event ignored (stale — predates current start request)');
          return;
        }
        workoutActiveRef.current = state === 'started';
        markContact();
      },
    );

    const watchAppStateSub = WatchConnectivity.addListener('onWatchAppState', ({ state }: { state: string }) => {
      logWc(`event watchAppState=${state}`);
      markContact();
    });

    logWc('activating WatchConnectivity');
    void WatchConnectivity.activate().catch((error: unknown) => {
      console.error('[useWatchHr] Failed to activate WatchConnectivity:', error);
    });

    return () => {
      clearAvailabilityTimer();
      companionStateSub.remove();
      reachabilitySub.remove();
      sessionStateSub.remove();
      watchAppStateSub.remove();
    };
  }, [watchAvailable, setWatchAvailability]);
}
