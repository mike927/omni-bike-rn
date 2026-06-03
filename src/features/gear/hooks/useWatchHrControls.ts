import { useCallback } from 'react';
import { Platform } from 'react-native';

import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { availableHrSources, type HrSource } from '../../../services/hr/hrSource';
import { useEffectivePrimary } from '../../../services/hr/useEffectiveHrSource';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useSavedGearStore } from '../../../store/savedGearStore';

interface WatchHrControls {
  readonly watchAvailable: boolean;
  /** Currently selected primary HR source (null = not yet persisted/hydrated). */
  readonly primary: HrSource | null;
  /**
   * The source actually in effect for display: the explicit primary when still
   * valid, otherwise the availability-ranked default. Always non-null. Resolved
   * against runtime Watch availability so it agrees with the engine and dashboard.
   */
  readonly effectivePrimary: HrSource;
  /** Persist a new primary HR source selection. */
  readonly setPrimary: (source: HrSource) => Promise<void>;
  /** Ordered list of sources the user can choose from (watch → bluetooth → bike). */
  readonly availableSources: HrSource[];
}

/**
 * UI hook for reading the Apple Watch availability and for the Primary HR source selector.
 *
 * Has no side effects of its own — the lifecycle (connect/disconnect,
 * reachability retry) is owned by `useWatchHr`, mounted once at the root
 * layout. Safe to mount in any number of screens without creating duplicate
 * Watch sessions.
 */
export function useWatchHrControls(): WatchHrControls {
  const watchAvailable = isAppleWatchAvailable(Platform.OS);

  const primary = useHrSourceStore((s) => s.primary);
  const hrSourceSetPrimary = useHrSourceStore((s) => s.setPrimary);

  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);

  const savedHrStrapName = savedHrSource?.name ?? null;

  // The selectable options stay platform-based (the Watch is always an option on
  // iOS, shown with its own readiness), but the *effective* primary resolves
  // against runtime availability so the selected/displayed source matches what
  // the engine actually reads.
  const availableSources = availableHrSources({
    watchSupported: watchAvailable,
    savedHrStrapName,
  });

  const effectivePrimary = useEffectivePrimary();

  const setPrimary = useCallback(
    async (source: HrSource) => {
      await hrSourceSetPrimary(source);
    },
    [hrSourceSetPrimary],
  );

  return {
    watchAvailable,
    primary,
    effectivePrimary,
    setPrimary,
    availableSources,
  };
}
