import { Platform } from 'react-native';

import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../store/hrSourceStore';
import { useSavedGearStore } from '../../store/savedGearStore';
import { isAppleWatchAvailable } from '../watch/isAppleWatchAvailable';
import { resolveEffectiveHrSource, resolveEffectivePrimary, type HrSource } from './hrSource';

// `watchSupported` is a *candidacy* signal — whether the Watch can ever be an HR
// source on this platform — NOT live readiness. It must use platform support
// (`isAppleWatchAvailable`), matching `useWatchHrControls`, so a Watch-capable
// iPhone keeps Watch as the default even while the companion is currently
// `unavailable` (pre-connect/backgrounded). Readiness is a separate axis rendered
// by `watchHrStatus` / `hrSourceIdleReadiness` from live `watchAvailability`.
// Deriving candidacy from live availability would resolve a no-primary/no-strap
// iPhone to `null` whenever the companion is transiently unavailable — dropping
// the documented Watch default and stalling the Watch lifecycle.
function watchSupported(): boolean {
  return isAppleWatchAvailable(Platform.OS);
}

function strapNameFrom(savedHrSource: { name: string } | null): string | null {
  return savedHrSource?.name ?? null;
}

/** Reactive effective *primary* HR source (user choice → availability default; no session lock). Null when none available. */
export function useEffectivePrimary(): HrSource | null {
  const primaryHrSource = useHrSourceStore((s) => s.primary);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  return resolveEffectivePrimary({
    primaryHrSource,
    watchSupported: watchSupported(),
    savedHrStrapName: strapNameFrom(savedHrSource),
  });
}

/** Reactive effective HR source including the per-session lock. Null when none available. */
export function useEffectiveHrSource(): HrSource | null {
  const activeHrSource = useDeviceConnectionStore((s) => s.activeHrSource);
  const primaryHrSource = useHrSourceStore((s) => s.primary);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  return resolveEffectiveHrSource({
    activeHrSource,
    primaryHrSource,
    watchSupported: watchSupported(),
    savedHrStrapName: strapNameFrom(savedHrSource),
  });
}

/**
 * Non-reactive effective HR source for services outside React (the
 * MetronomeEngine 1 Hz loop). Reads the same stores via `getState`.
 */
export function getEffectiveHrSource(): HrSource | null {
  const { activeHrSource } = useDeviceConnectionStore.getState();
  const { primary } = useHrSourceStore.getState();
  const { savedHrSource } = useSavedGearStore.getState();
  return resolveEffectiveHrSource({
    activeHrSource,
    primaryHrSource: primary,
    watchSupported: watchSupported(),
    savedHrStrapName: strapNameFrom(savedHrSource),
  });
}
