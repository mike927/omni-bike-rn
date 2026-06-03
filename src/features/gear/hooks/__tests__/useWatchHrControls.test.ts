import { act, renderHook } from '@testing-library/react-native';

import { useWatchHrControls } from '../useWatchHrControls';
import { useHrSourceStore } from '../../../../store/hrSourceStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';

jest.mock('../../../../services/preferences/appPreferencesStorage', () => ({
  loadPrimaryHrSource: jest.fn().mockResolvedValue(null),
  setPrimaryHrSource: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../services/gear/gearStorage');

jest.mock('../../../../services/watch/isAppleWatchAvailable', () => ({
  isAppleWatchAvailable: jest.fn().mockReturnValue(true),
}));

function getAppPreferencesMock() {
  return jest.requireMock('../../../../services/preferences/appPreferencesStorage') as {
    loadPrimaryHrSource: jest.Mock;
    setPrimaryHrSource: jest.Mock;
  };
}

function getIsAppleWatchAvailableMock() {
  return (
    jest.requireMock('../../../../services/watch/isAppleWatchAvailable') as {
      isAppleWatchAvailable: jest.Mock;
    }
  ).isAppleWatchAvailable;
}

beforeEach(() => {
  jest.clearAllMocks();
  useHrSourceStore.setState({ primary: null, hydrated: false });
  useSavedGearStore.setState({ savedHrSource: null, hydrated: false });
  useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
  getAppPreferencesMock().setPrimaryHrSource.mockResolvedValue(undefined);
  getIsAppleWatchAvailableMock().mockReturnValue(true);
});

describe('useWatchHrControls', () => {
  it('returns watchAvailable from isAppleWatchAvailable', () => {
    getIsAppleWatchAvailableMock().mockReturnValue(true);
    const { result } = renderHook(() => useWatchHrControls());
    expect(result.current.watchAvailable).toBe(true);
  });

  describe('primary HR source', () => {
    it('returns primary from hrSourceStore', () => {
      useHrSourceStore.setState({ primary: 'bike', hydrated: true });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.primary).toBe('bike');
    });

    it('returns null primary when not yet set', () => {
      useHrSourceStore.setState({ primary: null, hydrated: false });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.primary).toBeNull();
    });

    it('calls hrSourceStore.setPrimary when setPrimary is called', async () => {
      const { result } = renderHook(() => useWatchHrControls());

      await act(async () => {
        await result.current.setPrimary('watch');
      });

      expect(getAppPreferencesMock().setPrimaryHrSource).toHaveBeenCalledWith('watch');
      expect(useHrSourceStore.getState().primary).toBe('watch');
    });

    it('returns availableSources with only bike when watch unavailable and no strap', () => {
      getIsAppleWatchAvailableMock().mockReturnValue(false);
      useSavedGearStore.setState({ savedHrSource: null, hydrated: true });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.availableSources).toEqual(['bike']);
    });

    it('returns availableSources with watch and bike when watch available and no strap', () => {
      getIsAppleWatchAvailableMock().mockReturnValue(true);
      useSavedGearStore.setState({ savedHrSource: null, hydrated: true });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.availableSources).toEqual(['watch', 'bike']);
    });

    it('returns availableSources with watch, bluetooth, and bike when all sources available', () => {
      getIsAppleWatchAvailableMock().mockReturnValue(true);
      useSavedGearStore.setState({
        savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' },
        hydrated: true,
      });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.availableSources).toEqual(['watch', 'bluetooth', 'bike']);
    });
  });

  describe('effectivePrimary', () => {
    it('returns the explicit primary when it is still valid', () => {
      useHrSourceStore.setState({ primary: 'bike', hydrated: true });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.effectivePrimary).toBe('bike');
    });

    it('resolves the availability-ranked default when no primary is set (Watch connected)', () => {
      useHrSourceStore.setState({ primary: null, hydrated: true });
      useDeviceConnectionStore.setState({ watchAvailability: 'connected' });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.effectivePrimary).toBe('watch');
    });

    it('resolves to bike when no primary is set and the Watch is unavailable with no strap', () => {
      useHrSourceStore.setState({ primary: null, hydrated: true });
      useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.effectivePrimary).toBe('bike');
    });

    it('falls through a stale bluetooth primary when no strap is saved', () => {
      useHrSourceStore.setState({ primary: 'bluetooth', hydrated: true });
      useSavedGearStore.setState({ savedHrSource: null, hydrated: true });
      useDeviceConnectionStore.setState({ watchAvailability: 'connected' });
      const { result } = renderHook(() => useWatchHrControls());
      expect(result.current.effectivePrimary).toBe('watch');
    });
  });
});
