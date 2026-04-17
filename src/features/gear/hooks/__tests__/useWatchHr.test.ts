import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useWatchHr } from '../useWatchHr';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { useWatchHrStore } from '../../../../store/watchHrStore';
import { TrainingPhase } from '../../../../types/training';

// ── Module mocks ──────────────────────────────────────────────────────────────

type NativeWatchSessionStatePayload = { state: 'started' | 'ended' | 'failed'; sentAtMs: number };

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
    watchReachable: false,
    watchSessionState: 'idle',
  });
  useTrainingSessionStore.setState({ phase: TrainingPhase.Idle } as never);
  useWatchHrStore.setState({ enabled: false, hydrated: false });
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
  it('does not add any listeners when Watch is not available', () => {
    getIsAppleWatchAvailableMock().mockReturnValue(false);

    renderHook(() => useWatchHr());

    const wc = getWatchConnectivityMock();
    expect(wc.addListener).not.toHaveBeenCalled();
  });

  it('hydrates the persisted preference on mount', async () => {
    getAppPreferencesMock().loadWatchHrEnabled.mockResolvedValue(true);

    renderHook(() => useWatchHr());

    await waitFor(() => {
      expect(useWatchHrStore.getState().enabled).toBe(true);
      expect(useWatchHrStore.getState().hydrated).toBe(true);
    });
  });

  it('activates WatchConnectivity on mount to hydrate reachability state', () => {
    renderHook(() => useWatchHr());

    expect(getWatchConnectivityMock().activate).toHaveBeenCalledTimes(1);
  });

  describe('training phase transitions', () => {
    it('starts the stream when phase transitions to Active and Watch HR is enabled', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });

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
      useWatchHrStore.setState({ enabled: false, hydrated: true });

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
      expect(WatchHrAdapter.mock.instances).toHaveLength(0);
    });

    it('does not log an error when the initial Active transition races Watch reachability', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      useWatchHrStore.setState({ enabled: true, hydrated: true });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      const startWatchAppFailure = Object.assign(new Error('Apple Watch app could not be launched'), {
        code: 'ERR_START_WATCH_APP_FAILED',
      });
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(startWatchAppFailure),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
      }));

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('logs unexpected connect failures when phase transitions to Active', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      useWatchHrStore.setState({ enabled: true, hydrated: true });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(new Error('WCSession activation failed')),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
      }));

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('[useWatchHr] Failed to connect Watch HR:', expect.any(Error));
      });
    });

    it('does not stop the stream when phase transitions from Active to Paused', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
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

      await act(async () => {
        await Promise.resolve();
      });

      const inst = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
      expect(inst?.disconnect).not.toHaveBeenCalled();
    });

    it('stops the stream when phase transitions to Idle', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
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

    it('stops the stream when phase transitions to Finished', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
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
        useTrainingSessionStore.setState({ phase: TrainingPhase.Finished } as never);
      });
      rerender({});

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
        expect(inst?.disconnect).toHaveBeenCalled();
      });
    });

    it('stops the stream when Watch HR is disabled mid-session', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
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
        useWatchHrStore.setState({ enabled: false });
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

    it('stores the latest reachability value from the native module', () => {
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const reachabilityCallback = wc.addListener.mock.calls[0]?.[1] as
        | ((payload: { reachable: boolean }) => void)
        | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: true });
      });

      expect(useDeviceConnectionStore.getState().watchReachable).toBe(true);
    });

    it('stores watch session state updates from the native module', () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      const { rerender } = renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const sessionStateCallback = wc.addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onWatchSessionState',
      )?.[1] as ((payload: NativeWatchSessionStatePayload) => void) | undefined;

      act(() => {
        sessionStateCallback?.({ state: 'started', sentAtMs: Date.now() });
      });
      expect(useDeviceConnectionStore.getState().watchSessionState).toBe('active');

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Finished } as never);
      });
      rerender({});
      const updatedSessionStateCallback = wc.addListener.mock.calls
        .slice()
        .reverse()
        .find(([eventName]: [string]) => eventName === 'onWatchSessionState')?.[1] as
        | ((payload: NativeWatchSessionStatePayload) => void)
        | undefined;
      act(() => {
        updatedSessionStateCallback?.({ state: 'ended', sentAtMs: Date.now() });
      });
      expect(useDeviceConnectionStore.getState().watchSessionState).toBe('ended');
    });

    it('ignores stale watch session state events from before the current start request', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });

      const { rerender } = renderHook(() => useWatchHr());

      const staleSentAtMs = Date.now() - 10_000;

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      const wc = getWatchConnectivityMock();
      const sessionStateCallback = wc.addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onWatchSessionState',
      )?.[1] as ((payload: NativeWatchSessionStatePayload) => void) | undefined;

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        sessionStateCallback?.({ state: 'ended', sentAtMs: staleSentAtMs });
      });

      expect(useDeviceConnectionStore.getState().watchSessionState).toBe('starting');
    });
  });

  describe('on-mount with phase already Active', () => {
    it('starts the stream immediately on mount when phase is Active and Watch HR is enabled', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
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
      useWatchHrStore.setState({ enabled: true, hydrated: true });
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
      useWatchHrStore.setState({ enabled: false, hydrated: true });
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
