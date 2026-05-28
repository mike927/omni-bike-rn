import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { WatchConnectivity } from 'watch-connectivity';
import { WatchHrAdapter } from '../../../services/watch/WatchHrAdapter';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import { resolveEffectivePrimary } from '../../../services/hr/hrSource';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import type { WatchSessionStateEvent } from '../../../types/watch';
import { logWc } from '../../../services/watch/wcLog';

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

  const updateAppleWatchHr = useDeviceConnectionStore((s) => s.updateAppleWatchHr);
  const updateAppleWatchActiveKcal = useDeviceConnectionStore((s) => s.updateAppleWatchActiveKcal);
  const setWatchAvailability = useDeviceConnectionStore((s) => s.setWatchAvailability);
  const setActiveHrSource = useDeviceConnectionStore((s) => s.setActiveHrSource);
  const phase = useTrainingSessionStore((s) => s.phase);
  const primary = useHrSourceStore((s) => s.primary);
  const hrSourceHydrated = useHrSourceStore((s) => s.hydrated);
  const hydrateHrSourcePref = useHrSourceStore((s) => s.hydrate);
  const watchAvailability = useDeviceConnectionStore((s) => s.watchAvailability);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);

  // The effective primary the engine also resolves to: the user's explicit
  // choice when still valid, else the availability-ranked default. Resolved
  // against runtime availability so the lifecycle starts/locks the same source
  // the dashboard and engine display/read.
  //
  // Tolerates a pre-hydration `null` primary: until the persisted preference
  // resolves we keep `null` so no watch stream starts prematurely (a non-watch
  // primary would otherwise immediately tear it back down). The reachability-retry
  // path recovers the stream if the Watch becomes reachable later.
  const effectivePrimary = hrSourceHydrated
    ? resolveEffectivePrimary({
        primaryHrSource: primary,
        watchSupported: watchAvailability !== 'unavailable',
        savedHrStrapName: savedHrSource?.name ?? null,
      })
    : null;

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
          // Resuming: the stream is still connected; tell the Watch to resume its session.
          logWc('phase Paused→Active — sending resumeMirroredWorkout');
          void WatchConnectivity.resumeMirroredWorkout().catch((error: unknown) => {
            console.error('[useWatchHr] Failed to resume Watch workout:', error);
          });
        }
      } else {
        // effective primary is not watch while session is active: tear down watch stream.
        void stopStream();
      }
    } else if (phase === TrainingPhase.Paused && effectivePrimary === 'watch') {
      // Keep the stream alive but pause the Watch session so its workout timer and HR
      // collection stop in sync with the iPhone (the Watch owns the HKWorkoutSession).
      logWc('phase Active→Paused — sending pauseMirroredWorkout');
      void WatchConnectivity.pauseMirroredWorkout().catch((error: unknown) => {
        console.error('[useWatchHr] Failed to pause Watch workout:', error);
      });
    } else if (phase === TrainingPhase.Finished || phase === TrainingPhase.Idle) {
      // Always tear down on Finish/Idle — `stopStream` is idempotent. Gating on the
      // current primary would leak a Watch session that was paused and then had the
      // primary switched away before finishing (finding #2).
      void stopStream();
    }
  }, [phase, effectivePrimary, startStream, stopStream, watchAvailable]);

  // Unmount-only cleanup, scoped away from phase transitions so Active→Paused
  // does not tear down the Watch workout session.
  useEffect(() => {
    return () => {
      void stopStreamRef.current();
    };
  }, []);

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
