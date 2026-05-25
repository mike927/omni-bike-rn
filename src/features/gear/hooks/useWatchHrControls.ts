import { useCallback } from 'react';
import { Platform } from 'react-native';

import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { availableHrSources, type HrSource } from '../../../services/hr/hrSource';
import { useWatchHrStore } from '../../../store/watchHrStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useSavedGearStore } from '../../../store/savedGearStore';

interface WatchHrControls {
  readonly watchAvailable: boolean;
  readonly watchHrEnabled: boolean;
  readonly enableWatchHr: () => Promise<void>;
  readonly disableWatchHr: () => Promise<void>;
  /** Currently selected primary HR source (null = not yet persisted/hydrated). */
  readonly primary: HrSource | null;
  /** Persist a new primary HR source selection. */
  readonly setPrimary: (source: HrSource) => Promise<void>;
  /** Ordered list of sources the user can choose from (watch → bluetooth → bike). */
  readonly availableSources: HrSource[];
}

/**
 * UI hook for reading and toggling the Apple Watch HR preference, and for the
 * Primary HR source selector added in T7.
 *
 * Has no side effects of its own — the lifecycle (connect/disconnect,
 * reachability retry) is owned by `useWatchHr`, mounted once at the root
 * layout. Safe to mount in any number of screens without creating duplicate
 * Watch sessions.
 */
export function useWatchHrControls(): WatchHrControls {
  const watchAvailable = isAppleWatchAvailable(Platform.OS);
  const watchHrEnabled = useWatchHrStore((s) => s.enabled);
  const setEnabled = useWatchHrStore((s) => s.setEnabled);

  const primary = useHrSourceStore((s) => s.primary);
  const hrSourceSetPrimary = useHrSourceStore((s) => s.setPrimary);

  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);

  const availableSources = availableHrSources({
    watchSupported: watchAvailable,
    savedHrStrapName: savedHrSource?.name ?? null,
  });

  const enableWatchHr = useCallback(async () => {
    await setEnabled(true);
  }, [setEnabled]);

  const disableWatchHr = useCallback(async () => {
    await setEnabled(false);
  }, [setEnabled]);

  const setPrimary = useCallback(
    async (source: HrSource) => {
      await hrSourceSetPrimary(source);
    },
    [hrSourceSetPrimary],
  );

  return {
    watchAvailable,
    watchHrEnabled,
    enableWatchHr,
    disableWatchHr,
    primary,
    setPrimary,
    availableSources,
  };
}
