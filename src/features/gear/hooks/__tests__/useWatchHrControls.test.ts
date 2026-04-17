import { act, renderHook } from '@testing-library/react-native';

import { useWatchHrControls } from '../useWatchHrControls';
import { useWatchHrStore } from '../../../../store/watchHrStore';

jest.mock('../../../../services/preferences/appPreferencesStorage', () => ({
  loadWatchHrEnabled: jest.fn(),
  setWatchHrEnabled: jest.fn(),
}));

jest.mock('../../../../services/watch/isAppleWatchAvailable', () => ({
  isAppleWatchAvailable: jest.fn().mockReturnValue(true),
}));

function getAppPreferencesMock() {
  return jest.requireMock('../../../../services/preferences/appPreferencesStorage') as {
    loadWatchHrEnabled: jest.Mock;
    setWatchHrEnabled: jest.Mock;
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
  useWatchHrStore.setState({ enabled: false, hydrated: false });
  getAppPreferencesMock().setWatchHrEnabled.mockResolvedValue(undefined);
  getIsAppleWatchAvailableMock().mockReturnValue(true);
});

describe('useWatchHrControls', () => {
  it('returns watchAvailable from isAppleWatchAvailable', () => {
    getIsAppleWatchAvailableMock().mockReturnValue(true);
    const { result } = renderHook(() => useWatchHrControls());
    expect(result.current.watchAvailable).toBe(true);
  });

  it('returns watchHrEnabled from the store', () => {
    useWatchHrStore.setState({ enabled: true, hydrated: true });
    const { result } = renderHook(() => useWatchHrControls());
    expect(result.current.watchHrEnabled).toBe(true);
  });

  it('persists and updates the store when enableWatchHr is called', async () => {
    const { result } = renderHook(() => useWatchHrControls());

    await act(async () => {
      await result.current.enableWatchHr();
    });

    expect(getAppPreferencesMock().setWatchHrEnabled).toHaveBeenCalledWith(true);
    expect(useWatchHrStore.getState().enabled).toBe(true);
  });

  it('persists and updates the store when disableWatchHr is called', async () => {
    useWatchHrStore.setState({ enabled: true, hydrated: true });
    const { result } = renderHook(() => useWatchHrControls());

    await act(async () => {
      await result.current.disableWatchHr();
    });

    expect(getAppPreferencesMock().setWatchHrEnabled).toHaveBeenCalledWith(false);
    expect(useWatchHrStore.getState().enabled).toBe(false);
  });
});
