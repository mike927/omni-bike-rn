import { useCallback } from 'react';
import { Platform } from 'react-native';

import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { useWatchHrStore } from '../../../store/watchHrStore';

interface WatchHrControls {
  readonly watchAvailable: boolean;
  readonly watchHrEnabled: boolean;
  readonly enableWatchHr: () => Promise<void>;
  readonly disableWatchHr: () => Promise<void>;
}

/**
 * UI hook for reading and toggling the Apple Watch HR preference. Has no side
 * effects of its own — the lifecycle (connect/disconnect, reachability retry)
 * is owned by `useWatchHr`, mounted once at the root layout. Safe to mount in
 * any number of screens without creating duplicate Watch sessions.
 */
export function useWatchHrControls(): WatchHrControls {
  const watchAvailable = isAppleWatchAvailable(Platform.OS);
  const watchHrEnabled = useWatchHrStore((s) => s.enabled);
  const setEnabled = useWatchHrStore((s) => s.setEnabled);

  const enableWatchHr = useCallback(async () => {
    await setEnabled(true);
  }, [setEnabled]);

  const disableWatchHr = useCallback(async () => {
    await setEnabled(false);
  }, [setEnabled]);

  return {
    watchAvailable,
    watchHrEnabled,
    enableWatchHr,
    disableWatchHr,
  };
}
