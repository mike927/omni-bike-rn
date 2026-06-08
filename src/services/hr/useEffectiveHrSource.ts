import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../store/hrSourceStore';
import { useSavedGearStore } from '../../store/savedGearStore';
import type { WatchAvailability } from '../../types/watch';
import { resolveEffectiveHrSource, resolveEffectivePrimary, type HrSource } from './hrSource';

// watchAvailability is always set in the store, so `!== 'unavailable'` fully
// determines support. Centralized so every caller assembles resolver inputs identically.
function watchSupportedFrom(watchAvailability: WatchAvailability): boolean {
  return watchAvailability !== 'unavailable';
}

function strapNameFrom(savedHrSource: { name: string } | null): string | null {
  return savedHrSource?.name ?? null;
}

/** Reactive effective *primary* HR source (user choice → availability default; no session lock). Null when none available. */
export function useEffectivePrimary(): HrSource | null {
  const primaryHrSource = useHrSourceStore((s) => s.primary);
  const watchAvailability = useDeviceConnectionStore((s) => s.watchAvailability);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  return resolveEffectivePrimary({
    primaryHrSource,
    watchSupported: watchSupportedFrom(watchAvailability),
    savedHrStrapName: strapNameFrom(savedHrSource),
  });
}

/** Reactive effective HR source including the per-session lock. Null when none available. */
export function useEffectiveHrSource(): HrSource | null {
  const activeHrSource = useDeviceConnectionStore((s) => s.activeHrSource);
  const primaryHrSource = useHrSourceStore((s) => s.primary);
  const watchAvailability = useDeviceConnectionStore((s) => s.watchAvailability);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  return resolveEffectiveHrSource({
    activeHrSource,
    primaryHrSource,
    watchSupported: watchSupportedFrom(watchAvailability),
    savedHrStrapName: strapNameFrom(savedHrSource),
  });
}

/**
 * Non-reactive effective HR source for services outside React (the
 * MetronomeEngine 1 Hz loop). Reads the same stores via `getState`.
 */
export function getEffectiveHrSource(): HrSource | null {
  const { activeHrSource, watchAvailability } = useDeviceConnectionStore.getState();
  const { primary } = useHrSourceStore.getState();
  const { savedHrSource } = useSavedGearStore.getState();
  return resolveEffectiveHrSource({
    activeHrSource,
    primaryHrSource: primary,
    watchSupported: watchSupportedFrom(watchAvailability),
    savedHrStrapName: strapNameFrom(savedHrSource),
  });
}
