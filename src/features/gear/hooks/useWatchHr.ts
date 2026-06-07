import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { WatchConnectivity } from 'watch-connectivity';
import { WatchHrAdapter } from '../../../services/watch/WatchHrAdapter';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useEffectivePrimary } from '../../../services/hr/useEffectiveHrSource';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import type { WatchSessionStateEvent } from '../../../types/watch';
import { logWc } from '../../../services/watch/wcLog';
import { HR_NO_SIGNAL_TIMEOUT_MS } from '../../../services/hr/hrSource';

// Cadence of the mid-ride HR-drop watchdog. A drop is detected within roughly one
// freshness window + one tick of silence; frequent enough to recover promptly,
// sparse enough not to churn while the stream is healthy.
const WATCH_HR_DROP_CHECK_INTERVAL_MS = 5_000;

// Settle window for pause/resume sends. A rapid Active⇄Paused toggle fires a transition
// per tap; without coalescing, the burst floods the Watch and can race its HKWorkoutSession
// into a fatal pause()-while-paused. Debounce so only the final, settled intent is sent.
// Short enough to stay responsive for a single deliberate tap.
const WATCH_PAUSE_RESUME_DEBOUNCE_MS = 350;

/**
 * Root-only hook that owns the Apple Watch HR lifecycle.
 *
 * Tracks the Watch with a two-state, companion-presence availability model:
 *   connected   — companion event reports available=true (isPaired && isWatchAppInstalled).
 *   unavailable — companion event reports available=false.
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
  // Wall-clock of the last drop-triggered reconnect, so the watchdog backs off a
  // full freshness window between attempts and never storms when a reconnect
  // succeeds but the Watch still produces no HR.
  const lastDropReconnectAtRef = useRef(0);

  const updateAppleWatchHr = useDeviceConnectionStore((s) => s.updateAppleWatchHr);
  const updateAppleWatchActiveKcal = useDeviceConnectionStore((s) => s.updateAppleWatchActiveKcal);
  const setWatchAvailability = useDeviceConnectionStore((s) => s.setWatchAvailability);
  const setActiveHrSource = useDeviceConnectionStore((s) => s.setActiveHrSource);
  const phase = useTrainingSessionStore((s) => s.phase);
  const hrSourceHydrated = useHrSourceStore((s) => s.hydrated);
  const hydrateHrSourcePref = useHrSourceStore((s) => s.hydrate);

  const resolvedPrimary = useEffectivePrimary();
  // Until the persisted preference hydrates, keep null so no watch stream starts
  // prematurely (a non-watch primary would immediately tear it back down).
  const effectivePrimary = hrSourceHydrated ? resolvedPrimary : null;

  // Hydrate primary source unconditionally — non-watch primaries (bluetooth, bike) also
  // need to be known at workout start so the lock is correct on all platforms/configs.
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

  // Session-level HR source lock. Tracks the effective primary while Active so a
  // mid-workout source change retargets the lock; an explicit choice is stable, while
  // a never-chosen default follows availability (matching the engine's per-tick
  // resolution). Null pre-hydration. Cleared when not training.
  useEffect(() => {
    if (phase === TrainingPhase.Active) {
      setActiveHrSource(effectivePrimary);
    } else if (phase === TrainingPhase.Idle || phase === TrainingPhase.Finished) {
      setActiveHrSource(null);
    }
    // Paused: leave the lock intact.
  }, [phase, effectivePrimary, setActiveHrSource]);

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
        effectivePrimaryRef.current !== 'watch';
      if (startWasSuperseded) return;
      console.error('[useWatchHr] Failed to connect Watch HR:', err);
      return;
    }

    const startWasSuperseded =
      streamGeneration !== streamGenerationRef.current ||
      phaseRef.current !== TrainingPhase.Active ||
      effectivePrimaryRef.current !== 'watch';
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
  const effectivePrimaryRef = useRef(effectivePrimary);
  const startStreamRef = useRef(startStream);
  const stopStreamRef = useRef(stopStream);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    effectivePrimaryRef.current = effectivePrimary;
  }, [effectivePrimary]);
  useEffect(() => {
    startStreamRef.current = startStream;
  }, [startStream]);
  useEffect(() => {
    stopStreamRef.current = stopStream;
  }, [stopStream]);

  // Debounced pause/resume sender. Rapid Active⇄Paused toggling used to fire a command on
  // every transition; coalesce to a single send of the settled, final intent (read live from
  // phaseRef at fire time) so the Watch is never flooded into a pause()-while-paused failure.
  const watchSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWatchSyncTimer = useCallback(() => {
    if (watchSyncTimerRef.current) {
      clearTimeout(watchSyncTimerRef.current);
      watchSyncTimerRef.current = null;
    }
  }, []);
  const scheduleWatchPauseResume = useCallback(() => {
    clearWatchSyncTimer();
    watchSyncTimerRef.current = setTimeout(() => {
      watchSyncTimerRef.current = null;
      if (phaseRef.current === TrainingPhase.Paused) {
        logWc('phase settled → Paused — sending pauseMirroredWorkout');
        void WatchConnectivity.pauseMirroredWorkout().catch((error: unknown) => {
          console.error('[useWatchHr] Failed to pause Watch workout:', error);
        });
      } else if (phaseRef.current === TrainingPhase.Active) {
        logWc('phase settled → Active — sending resumeMirroredWorkout');
        void WatchConnectivity.resumeMirroredWorkout().catch((error: unknown) => {
          console.error('[useWatchHr] Failed to resume Watch workout:', error);
        });
      }
      // Idle/Finished: the session is ending; stopStream/endMirroredWorkout owns that.
    }, WATCH_PAUSE_RESUME_DEBOUNCE_MS);
  }, [clearWatchSyncTimer]);

  // Tracks the phase the previous run saw, so a resume (Paused→Active) is told apart
  // from a fresh start (Idle→Active) and the right pause/resume command is emitted.
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (!watchAvailable) return;
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === TrainingPhase.Active) {
      if (effectivePrimary === 'watch') {
        void startStream();
        if (prevPhase === TrainingPhase.Paused) {
          // Resuming: the stream is still connected; tell the Watch to resume its session
          // (debounced, so a rapid pause/resume toggle collapses to the final intent).
          scheduleWatchPauseResume();
        }
      } else {
        // effective primary is not watch while session is active: tear down watch stream.
        void stopStream();
      }
    } else if (phase === TrainingPhase.Paused && effectivePrimary === 'watch') {
      // Keep the stream alive but pause the Watch session so its workout timer and HR
      // collection stop in sync with the iPhone (the Watch owns the HKWorkoutSession).
      scheduleWatchPauseResume();
    } else if (phase === TrainingPhase.Finished || phase === TrainingPhase.Idle) {
      // Always tear down on Finish/Idle — `stopStream` is idempotent. Gating on the
      // current primary would leak a Watch session that was paused and then had the
      // primary switched away before finishing (finding #2). Cancel any pending
      // pause/resume so a stale command can't land after the ride ends.
      clearWatchSyncTimer();
      void stopStream();
    }
  }, [phase, effectivePrimary, startStream, stopStream, watchAvailable, scheduleWatchPauseResume, clearWatchSyncTimer]);

  // Mid-ride HR-drop watchdog. A Watch can stop delivering HR without any
  // JS-visible disconnect — out of range and back, an HKLiveWorkoutBuilder stall,
  // or a dead mirrored session — and `adapterRef` stays non-null. The reachability
  // retry is gated on `!adapterRef.current`, so it never re-fires and the tile is
  // stuck on "No signal" for the rest of the ride. Detect silence past the freshness
  // window on an established stream and treat it as a drop: soft-reset the stale
  // adapter (no `disconnect`, so a still-alive Watch session is not ended) and let
  // the start path re-establish the stream. Only runs while a watch-primary ride is
  // Active — pause silence is legitimate, and the cleared interval ignores it.
  useEffect(() => {
    if (!watchAvailable) return;
    if (phase !== TrainingPhase.Active || effectivePrimary !== 'watch') return;

    const interval = setInterval(() => {
      // Nothing to recover unless a stream is established and idle. While null, the
      // reachability retry owns reconnection; while starting, let it resolve.
      if (!adapterRef.current || startingRef.current) return;
      if (AppState.currentState !== 'active') return;
      const lastSampleAt = useDeviceConnectionStore.getState().lastAppleWatchSampleAtMs;
      // No sample yet this stream is the "Connecting…" case, not a drop.
      if (lastSampleAt === null) return;
      const now = Date.now();
      if (now - lastSampleAt <= HR_NO_SIGNAL_TIMEOUT_MS) return;
      if (now - lastDropReconnectAtRef.current <= HR_NO_SIGNAL_TIMEOUT_MS) return;
      lastDropReconnectAtRef.current = now;

      logWc('HR silent past freshness window mid-ride — treating Watch as dropped, reconnecting');
      subRef.current?.remove();
      subRef.current = null;
      kcalSubRef.current?.remove();
      kcalSubRef.current = null;
      adapterRef.current = null;
      void startStreamRef.current();
    }, WATCH_HR_DROP_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [watchAvailable, phase, effectivePrimary]);

  // Unmount-only cleanup, scoped away from phase transitions so Active→Paused
  // does not tear down the Watch workout session.
  useEffect(() => {
    return () => {
      clearWatchSyncTimer();
      void stopStreamRef.current();
    };
  }, [clearWatchSyncTimer]);

  useEffect(() => {
    if (!watchAvailable) return;

    // Companion presence drives availability: available = isPaired && isWatchAppInstalled.
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
        setWatchAvailability(available ? 'connected' : 'unavailable');
      },
    );

    // Reachability drives the mid-ride stream-retry only; does NOT set availability.
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
        // Mid-ride stream-retry when the Watch becomes reachable again. Gated on the
        // app being foreground: `startWatchApp` cannot launch the Watch app from the
        // background, so a re-wake probe there only throws and burns cycles.
        if (
          reachable &&
          AppState.currentState === 'active' &&
          effectivePrimaryRef.current === 'watch' &&
          phaseRef.current === TrainingPhase.Active &&
          !adapterRef.current &&
          !startingRef.current
        ) {
          logWc('reachable mid-ride — retrying HR stream');
          void startStreamRef.current();
        }
      },
    );

    // Session state: logging only (stale-sentAtMs guard preserved). Does NOT set availability.
    const sessionStateSub = WatchConnectivity.addListener(
      'onWatchSessionState',
      ({ state, sentAtMs }: { state: WatchSessionStateEvent; sentAtMs: number }) => {
        logWc(`event session state=${state} sentAtMs=${sentAtMs} latestStart=${latestStartRequestAtRef.current}`);
        // Session events are logging-only; availability is companion-driven. The stale-sentAtMs
        // guard is preserved purely for log clarity.
        if (sentAtMs < latestStartRequestAtRef.current) {
          logWc('session event ignored (stale — predates current start request)');
        }
      },
    );

    // Watch app state: logging only. Does NOT set availability.
    const watchAppStateSub = WatchConnectivity.addListener('onWatchAppState', ({ state }: { state: string }) => {
      logWc(`event watchAppState=${state}`);
    });

    logWc('activating WatchConnectivity');
    void WatchConnectivity.activate().catch((error: unknown) => {
      console.error('[useWatchHr] Failed to activate WatchConnectivity:', error);
    });

    return () => {
      companionStateSub.remove();
      reachabilitySub.remove();
      sessionStateSub.remove();
      watchAppStateSub.remove();
    };
  }, [watchAvailable, setWatchAvailability]);
}
