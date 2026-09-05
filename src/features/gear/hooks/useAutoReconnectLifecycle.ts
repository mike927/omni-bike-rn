import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { releaseReconnectSchedules, syncBikeReconnect, syncHrReconnect } from '../reconnectController';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';

/**
 * Root-only hook that owns the auto-reconnect lifecycle.
 *
 * Mounted exactly once, from `useAppInitialization`, so a reconnect cycle has a
 * single owner that outlives every screen. Screens mount `useAutoReconnect`,
 * which only reads state and issues Retry: a screen being pushed, popped or
 * revisited can therefore neither restart a live cycle, nor cancel one, nor add
 * a second probe budget to it.
 *
 * Its whole job is to notice the things a module cannot subscribe to and hand
 * them to `reconnectController`:
 *  - saved gear (hydration, which devices are saved, reconnect state, manual
 *    auto-reconnect suppression);
 *  - live connection state (adapter present, connect in flight);
 *  - whether the app is in the foreground, since a backgrounded app must not
 *    keep probing.
 *
 * One effect per role, so a bike change never re-arms the strap's pending wait
 * and vice versa.
 */
export function useAutoReconnectLifecycle(): void {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  const hydrated = useSavedGearStore((s) => s.hydrated);
  const savedBike = useSavedGearStore((s) => s.savedBike);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  const bikeReconnectState = useSavedGearStore((s) => s.bikeReconnectState);
  const hrReconnectState = useSavedGearStore((s) => s.hrReconnectState);
  const bikeAutoReconnectSuppressed = useSavedGearStore((s) => s.bikeAutoReconnectSuppressed);
  const hrAutoReconnectSuppressed = useSavedGearStore((s) => s.hrAutoReconnectSuppressed);
  const bikeAdapter = useDeviceConnectionStore((s) => s.bikeAdapter);
  const hrAdapter = useDeviceConnectionStore((s) => s.hrAdapter);
  const bikeConnectionInProgress = useDeviceConnectionStore((s) => s.bikeConnectionInProgress);
  const hrConnectionInProgress = useDeviceConnectionStore((s) => s.hrConnectionInProgress);

  const appActive = appState === 'active';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    syncBikeReconnect(appActive);
  }, [
    appActive,
    hydrated,
    savedBike,
    bikeReconnectState,
    bikeAdapter,
    bikeConnectionInProgress,
    bikeAutoReconnectSuppressed,
  ]);

  useEffect(() => {
    syncHrReconnect(appActive);
  }, [
    appActive,
    hydrated,
    savedHrSource,
    hrReconnectState,
    hrAdapter,
    hrConnectionInProgress,
    hrAutoReconnectSuppressed,
  ]);

  // Teardown belongs to the root, not to a screen: only the app tree going away
  // stands the policy down.
  useEffect(
    () => () => {
      releaseReconnectSchedules();
    },
    [],
  );
}
