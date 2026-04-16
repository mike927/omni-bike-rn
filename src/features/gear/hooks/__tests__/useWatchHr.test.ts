import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useWatchHr } from '../useWatchHr';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../../types/training';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('watch-connectivity', () => ({
  WatchConnectivity: {
    activate: jest.fn(),
    sendMessage: jest.fn(),
    addListener: jest.fn(),
  },
}));

jest.mock('../../../../services/preferences/appPreferencesStorage', () => ({
  loadWatchHrEnabled: jest.fn(),
  setWatchHrEnabled: jest.fn(),
}));

jest.mock('../../../../services/watch/isAppleWatchAvailable', () => ({
  isAppleWatchAvailable: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../services/watch/WatchHrAdapter', () => ({
  WatchHrAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
  })),
}));

// ── Typed helpers ─────────────────────────────────────────────────────────────

function getWatchConnectivityMock() {
  const mod = jest.requireMock('watch-connectivity') as {
    WatchConnectivity: {
      activate: jest.Mock;
      sendMessage: jest.Mock;
      addListener: jest.Mock;
    };
  };
  return mod.WatchConnectivity;
}

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

// ── Store reset ───────────────────────────────────────────────────────────────

function resetStores() {
  useDeviceConnectionStore.setState({
    bikeAdapter: null,
    hrAdapter: null,
    bikeConnectionInProgress: false,
    hrConnectionInProgress: false,
    latestBikeMetrics: null,
    latestBluetoothHr: null,
    latestAppleWatchHr: null,
  });
  useTrainingSessionStore.setState({ phase: TrainingPhase.Idle } as never);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetStores();

  const wc = getWatchConnectivityMock();
  wc.activate.mockResolvedValue(undefined);
  wc.sendMessage.mockReturnValue(true);
  wc.addListener.mockReturnValue({ remove: jest.fn() });

  const prefs = getAppPreferencesMock();
  prefs.loadWatchHrEnabled.mockResolvedValue(false);
  prefs.setWatchHrEnabled.mockResolvedValue(undefined);

  getIsAppleWatchAvailableMock().mockReturnValue(true);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWatchHr', () => {
  it('returns watchAvailable=true when isAppleWatchAvailable returns true', () => {
    const { result } = renderHook(() => useWatchHr());
    expect(result.current.watchAvailable).toBe(true);
  });

  it('does not start a stream or add any listeners when Watch is not available', () => {
    getIsAppleWatchAvailableMock().mockReturnValue(false);

    renderHook(() => useWatchHr());

    const wc = getWatchConnectivityMock();
    expect(wc.addListener).not.toHaveBeenCalled();
  });

  describe('enableWatchHr', () => {
    it('persists the preference and updates watchHrEnabled state', async () => {
      const { result } = renderHook(() => useWatchHr());

      await act(async () => {
        await result.current.enableWatchHr();
      });

      expect(getAppPreferencesMock().setWatchHrEnabled).toHaveBeenCalledWith(true);
      expect(result.current.watchHrEnabled).toBe(true);
    });

    it('does not start the stream when the session is Idle', async () => {
      useTrainingSessionStore.setState({ phase: TrainingPhase.Idle } as never);
      const { result } = renderHook(() => useWatchHr());

      await act(async () => {
        await result.current.enableWatchHr();
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      // No adapter should be instantiated if we never enter startStream
      expect(WatchHrAdapter.mock.instances).toHaveLength(0);
    });

    it('starts the stream immediately when the session is Active', async () => {
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      const { result } = renderHook(() => useWatchHr());

      await act(async () => {
        await result.current.enableWatchHr();
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      const adapterInstance = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
      expect(adapterInstance?.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disableWatchHr', () => {
    it('persists the preference, updates watchHrEnabled state, and stops any active stream', async () => {
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      const { result } = renderHook(() => useWatchHr());

      // Enable first so there is a stream to stop
      await act(async () => {
        await result.current.enableWatchHr();
      });

      await act(async () => {
        await result.current.disableWatchHr();
      });

      expect(getAppPreferencesMock().setWatchHrEnabled).toHaveBeenLastCalledWith(false);
      expect(result.current.watchHrEnabled).toBe(false);

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      const adapterInstance = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
      expect(adapterInstance?.disconnect).toHaveBeenCalledTimes(1);
    });

    it('clears latestAppleWatchHr in the store', async () => {
      useDeviceConnectionStore.setState({ latestAppleWatchHr: 80 });
      const { result } = renderHook(() => useWatchHr());

      await act(async () => {
        await result.current.disableWatchHr();
      });

      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBeNull();
    });
  });

  describe('training phase transitions', () => {
    it('starts the stream when phase transitions to Active and Watch HR is enabled', async () => {
      getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(true);

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await waitFor(() => {
        const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
          WatchHrAdapter: jest.Mock;
        };
        const adapterInstance = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(adapterInstance?.connect).toHaveBeenCalled();
      });
    });

    it('does not start the stream when phase transitions to Active but Watch HR is disabled', async () => {
      getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(false);

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      // Small wait to let any async effects settle
      await act(async () => {
        await Promise.resolve();
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      // No adapter should be instantiated when disabled
      expect(WatchHrAdapter.mock.instances).toHaveLength(0);
    });

    it('does not stop the stream when phase transitions from Active to Paused', async () => {
      getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(true);
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Paused } as never);
      });
      rerender({});

      // Give any async effects a chance to run
      await act(async () => {
        await Promise.resolve();
      });

      const inst = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
      expect(inst?.disconnect).not.toHaveBeenCalled();
    });

    it('stops the stream when phase transitions to Idle', async () => {
      getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(true);
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Idle } as never);
      });
      rerender({});

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
        expect(inst?.disconnect).toHaveBeenCalled();
      });
    });
  });

  describe('Watch reachability', () => {
    it('registers a reachability listener on mount', () => {
      renderHook(() => useWatchHr());
      expect(getWatchConnectivityMock().addListener).toHaveBeenCalledWith('onReachabilityChange', expect.any(Function));
    });

    it('clears latestAppleWatchHr when the Watch goes out of range', () => {
      useDeviceConnectionStore.setState({ latestAppleWatchHr: 72 });
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const reachabilityCallback = wc.addListener.mock.calls[0]?.[1] as
        | ((payload: { reachable: boolean }) => void)
        | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: false });
      });

      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBeNull();
    });

    it('does not clear latestAppleWatchHr when the Watch comes back in range', () => {
      useDeviceConnectionStore.setState({ latestAppleWatchHr: 72 });
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const reachabilityCallback = wc.addListener.mock.calls[0]?.[1] as
        | ((payload: { reachable: boolean }) => void)
        | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: true });
      });

      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(72);
    });
  });

  describe('on-mount with phase already Active', () => {
    it('starts the stream immediately on mount when phase is Active and Watch HR is enabled', async () => {
      getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(true);
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      renderHook(() => useWatchHr());

      await waitFor(() => {
        const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
          WatchHrAdapter: jest.Mock;
        };
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalledTimes(1);
      });
    });

    it('disconnects the adapter on unmount when the stream is active', async () => {
      getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(true);
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { unmount } = renderHook(() => useWatchHr());

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
        expect(inst?.disconnect).toHaveBeenCalled();
      });
    });

    it('does not start the stream on mount when phase is Active but Watch HR is disabled', async () => {
      getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(false);
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      renderHook(() => useWatchHr());

      await act(async () => {
        await Promise.resolve();
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      expect(WatchHrAdapter.mock.instances).toHaveLength(0);
    });
  });
});
