import { renderHook } from '@testing-library/react-native';

import { getEffectiveHrSource, useEffectiveHrSource, useEffectivePrimary } from '../useEffectiveHrSource';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import type { SavedDevice } from '../../../types/gear';

jest.mock('../../watch/isAppleWatchAvailable', () => ({
  isAppleWatchAvailable: jest.fn().mockReturnValue(true),
}));

function getIsAppleWatchAvailableMock() {
  return (
    jest.requireMock('../../watch/isAppleWatchAvailable') as {
      isAppleWatchAvailable: jest.Mock;
    }
  ).isAppleWatchAvailable;
}

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

beforeEach(() => {
  // Default: watch-capable platform (iPhone). Candidacy is platform-based, not
  // gated on live availability — readiness is a separate axis.
  getIsAppleWatchAvailableMock().mockReturnValue(true);
});

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
    it('drops a stale bluetooth primary and falls through to watch on a watch-capable platform', () => {
      setStores({ activeHrSource: null, primary: 'bluetooth', watchAvailability: 'unavailable', savedHrSource: null });
      expect(getEffectiveHrSource()).toBe('watch');
    });
    it('returns null when a stale bluetooth primary has no strap and no watch platform', () => {
      getIsAppleWatchAvailableMock().mockReturnValue(false);
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

    // Regression guard (PR review): watch candidacy is platform-based. A watch-capable
    // iPhone with no explicit primary and no strap must default to 'watch' even while
    // the companion is currently unavailable — never to null (which would render
    // "nothing selected" and stop the Watch lifecycle from ever starting).
    it('defaults to watch on a watch-capable platform even when the companion is unavailable', () => {
      getIsAppleWatchAvailableMock().mockReturnValue(true);
      setStores({ primary: null, savedHrSource: null, watchAvailability: 'unavailable' });
      const { result } = renderHook(() => useEffectivePrimary());
      expect(result.current).toBe('watch');
    });

    it('returns null when the platform has no watch and no strap is saved', () => {
      getIsAppleWatchAvailableMock().mockReturnValue(false);
      setStores({ primary: null, savedHrSource: null, watchAvailability: 'unavailable' });
      const { result } = renderHook(() => useEffectivePrimary());
      expect(result.current).toBeNull();
    });

    it('falls back to bluetooth when the platform has no watch but a strap is saved', () => {
      getIsAppleWatchAvailableMock().mockReturnValue(false);
      setStores({ primary: null, savedHrSource: STRAP, watchAvailability: 'unavailable' });
      const { result } = renderHook(() => useEffectivePrimary());
      expect(result.current).toBe('bluetooth');
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
