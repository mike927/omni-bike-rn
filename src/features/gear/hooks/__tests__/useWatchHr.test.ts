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
    watchAvailability: 'unavailable',
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

    it('cancels a pending start when Watch HR is disabled before connect resolves', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });

      let resolveConnect: (() => void) | null = null;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      const disconnect = jest.fn().mockResolvedValue(undefined);
      const subscribeToHeartRate = jest.fn().mockReturnValue({ remove: jest.fn() });
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockImplementation(() => connectPromise),
        disconnect,
        subscribeToHeartRate,
      }));

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        useWatchHrStore.setState({ enabled: false });
      });
      rerender({});

      await act(async () => {
        resolveConnect?.();
        await connectPromise;
      });

      await waitFor(() => {
        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(subscribeToHeartRate).not.toHaveBeenCalled();
      });
    });

    it('cancels a pending start when the session finishes before connect resolves', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });

      let resolveConnect: (() => void) | null = null;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      const disconnect = jest.fn().mockResolvedValue(undefined);
      const subscribeToHeartRate = jest.fn().mockReturnValue({ remove: jest.fn() });
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockImplementation(() => connectPromise),
        disconnect,
        subscribeToHeartRate,
      }));

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Finished } as never);
      });
      rerender({});

      await act(async () => {
        resolveConnect?.();
        await connectPromise;
      });

      await waitFor(() => {
        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(subscribeToHeartRate).not.toHaveBeenCalled();
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

    it('preserves the active watch stream when reachability drops mid-workout', () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      useDeviceConnectionStore.setState({ latestAppleWatchHr: 72, watchAvailability: 'in_progress' });
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const reachabilityCallback = wc.addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onReachabilityChange',
      )?.[1] as ((payload: { reachable: boolean }) => void) | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: false });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('in_progress');
      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(72);
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

    it('flips availability to idle when the Watch becomes reachable from unavailable', () => {
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const reachabilityCallback = wc.addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onReachabilityChange',
      )?.[1] as ((payload: { reachable: boolean }) => void) | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: true });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('idle');
    });

    it('maps started session events to in_progress and ended to idle', () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const sessionStateCallback = wc.addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onWatchSessionState',
      )?.[1] as ((payload: NativeWatchSessionStatePayload) => void) | undefined;

      act(() => {
        sessionStateCallback?.({ state: 'started', sentAtMs: Date.now() });
      });
      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('in_progress');

      act(() => {
        sessionStateCallback?.({ state: 'ended', sentAtMs: Date.now() });
      });
      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('idle');
    });

    it('marks the stream in progress again when a heart rate sample arrives while training is active', async () => {
      useWatchHrStore.setState({ enabled: true, hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
      renderHook(() => useWatchHr());

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });

      const subscribeToHeartRate = (WatchHrAdapter.mock.results[0]?.value as { subscribeToHeartRate: jest.Mock })
        .subscribeToHeartRate;
      const hrCallback = subscribeToHeartRate.mock.calls[0]?.[0] as ((hr: number) => void) | undefined;

      act(() => {
        hrCallback?.(147);
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('in_progress');
      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(147);
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
        sessionStateCallback?.({ state: 'started', sentAtMs: staleSentAtMs });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
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
