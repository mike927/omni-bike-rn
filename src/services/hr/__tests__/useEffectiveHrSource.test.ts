import { renderHook } from '@testing-library/react-native';

import { getEffectiveHrSource, useEffectiveHrSource, useEffectivePrimary } from '../useEffectiveHrSource';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import type { SavedDevice } from '../../../types/gear';

const STRAP: SavedDevice = { id: 'hr-1', name: 'Polar H10', type: 'hr' };

function setStores(opts: {
  activeHrSource?: 'watch' | 'bluetooth' | null;
  primary?: 'watch' | 'bluetooth' | null;
  watchAvailability?: 'connected' | 'unavailable';
  savedHrSource?: SavedDevice | null;
}) {
  useDeviceConnectionStore.setState({
    activeHrSource: opts.activeHrSource ?? null,
    watchAvailability: opts.watchAvailability ?? 'unavailable',
  });
  useHrSourceStore.setState({ primary: opts.primary ?? null });
  useSavedGearStore.setState({ savedHrSource: opts.savedHrSource ?? null });
}

describe('useEffectiveHrSource adapter', () => {
  describe('getEffectiveHrSource (non-reactive)', () => {
    it('returns the session-locked active source when set', () => {
      setStores({ activeHrSource: 'bluetooth', primary: 'watch', watchAvailability: 'connected' });
      expect(getEffectiveHrSource()).toBe('bluetooth');
    });
    it('falls back to the effective primary when no active lock', () => {
      setStores({ activeHrSource: null, primary: 'watch', watchAvailability: 'connected' });
      expect(getEffectiveHrSource()).toBe('watch');
    });
    it('returns null when a stale bluetooth primary has no strap and no watch', () => {
      setStores({ activeHrSource: null, primary: 'bluetooth', watchAvailability: 'unavailable', savedHrSource: null });
      expect(getEffectiveHrSource()).toBeNull();
    });
  });

  describe('useEffectivePrimary (reactive)', () => {
    it('resolves the primary from store state', () => {
      setStores({ primary: 'bluetooth', savedHrSource: STRAP, watchAvailability: 'unavailable' });
      const { result } = renderHook(() => useEffectivePrimary());
      expect(result.current).toBe('bluetooth');
    });
    it('returns null when watch unavailable and no strap', () => {
      setStores({ primary: null, savedHrSource: null, watchAvailability: 'unavailable' });
      const { result } = renderHook(() => useEffectivePrimary());
      expect(result.current).toBeNull();
    });
  });

  describe('useEffectiveHrSource (reactive)', () => {
    it('honors the active lock', () => {
      setStores({ activeHrSource: 'bluetooth', primary: 'watch', watchAvailability: 'connected' });
      const { result } = renderHook(() => useEffectiveHrSource());
      expect(result.current).toBe('bluetooth');
    });
  });
});
