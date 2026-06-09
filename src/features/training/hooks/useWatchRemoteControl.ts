import { useEffect, useRef } from 'react';

import { WatchConnectivity, isWatchConnectivityAvailable, type WatchControlRequestPayload } from 'watch-connectivity';

import { logWc } from '../../../services/watch/wcLog';

const WATCH_CONTROL_MAX_AGE_MS = 60_000;

export interface WatchRemoteControlHandlers {
  /** Pause the ride (same action as the on-screen Pause button). */
  onPause: () => void;
  /** Resume a paused ride. */
  onResume: () => void;
  /** Finish the ride and navigate to the summary (same as the Finish button). */
  onFinish: () => void | Promise<void>;
}

/**
 * Bridges Watch-initiated ride controls into the phone's training actions.
 *
 * The Watch is a remote control: tapping Pause / Resume / End on the wrist sends a
 * `watchControl` message to the iPhone, surfaced here as `onWatchControlRequest`. We
 * dispatch it to the **same** handlers a phone tap uses, so the MetronomeEngine, the
 * BLE bike control state, persistence, navigation, and the iPhone→Watch command path
 * (which pauses/ends the Watch's own HKWorkoutSession) all stay in lockstep. The
 * iPhone remains the single source of truth; phase guards live in the handlers, so a
 * stray request is a safe no-op.
 *
 * Mount this only while a ride is in progress (the Training dashboard) — that is the
 * only time Watch controls exist.
 */
export function useWatchRemoteControl(handlers: WatchRemoteControlHandlers): void {
  // Shadow the handlers in a ref so the listener subscribes exactly once. Re-subscribing
  // on every render would churn the native event bridge.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!isWatchConnectivityAvailable) return;
    const sub = WatchConnectivity.addListener(
      'onWatchControlRequest',
      ({ action, sentAtMs }: WatchControlRequestPayload) => {
        logWc(`event watchControl action=${action}`);
        if (
          typeof sentAtMs === 'number' &&
          Number.isFinite(sentAtMs) &&
          Date.now() - sentAtMs > WATCH_CONTROL_MAX_AGE_MS
        ) {
          logWc(`watchControl ignored — stale action=${action}`);
          return;
        }
        switch (action) {
          case 'pause':
            handlersRef.current.onPause();
            break;
          case 'resume':
            handlersRef.current.onResume();
            break;
          case 'end':
            void handlersRef.current.onFinish();
            break;
          default:
            logWc(`watchControl ignored — unknown action=${action}`);
        }
      },
    );
    return () => sub.remove();
  }, []);
}
