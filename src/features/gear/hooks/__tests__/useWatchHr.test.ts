import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useWatchHr, WATCH_REACHABILITY_GRACE_MS } from '../useWatchHr';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { useHrSourceStore } from '../../../../store/hrSourceStore';
import { TrainingPhase } from '../../../../types/training';

// ── Module mocks ──────────────────────────────────────────────────────────────

type NativeWatchSessionStatePayload = { state: 'started' | 'ended' | 'failed'; sentAtMs: number };

jest.mock('watch-connectivity', () => ({
  WatchConnectivity: {
    activate: jest.fn(),
    sendMessage: jest.fn(),
    addListener: jest.fn(),
    pauseMirroredWorkout: jest.fn(),
    resumeMirroredWorkout: jest.fn(),
  },
}));

jest.mock('../../../../services/preferences/appPreferencesStorage', () => ({
  loadPrimaryHrSource: jest.fn(),
  setPrimaryHrSource: jest.fn(),
}));

jest.mock('../../../../services/watch/isAppleWatchAvailable', () => ({
  isAppleWatchAvailable: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../services/watch/WatchHrAdapter', () => ({
  WatchHrAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
    subscribeToActiveKcal: jest.fn().mockReturnValue({ remove: jest.fn() }),
  })),
}));

// ── Typed helpers ─────────────────────────────────────────────────────────────

function getWatchConnectivityMock() {
  const mod = jest.requireMock('watch-connectivity') as {
    WatchConnectivity: {
      activate: jest.Mock;
      sendMessage: jest.Mock;
      addListener: jest.Mock;
      pauseMirroredWorkout: jest.Mock;
      resumeMirroredWorkout: jest.Mock;
    };
  };
  return mod.WatchConnectivity;
}

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
    latestAppleWatchActiveKcal: null,
    lastAppleWatchSampleAtMs: null,
    watchAvailability: 'unavailable',
    activeHrSource: null,
  });
  useTrainingSessionStore.setState({ phase: TrainingPhase.Idle } as never);
  useHrSourceStore.setState({ primary: null, hydrated: false });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetStores();

  const wc = getWatchConnectivityMock();
  wc.activate.mockResolvedValue(undefined);
  wc.sendMessage.mockReturnValue(true);
  wc.addListener.mockReturnValue({ remove: jest.fn() });
  wc.pauseMirroredWorkout.mockResolvedValue(undefined);
  wc.resumeMirroredWorkout.mockResolvedValue(undefined);

  const prefs = getAppPreferencesMock();
  prefs.loadPrimaryHrSource.mockResolvedValue(null);
  prefs.setPrimaryHrSource.mockResolvedValue(undefined);

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

  it('hydrates the persisted primary source preference on mount', async () => {
    getAppPreferencesMock().loadPrimaryHrSource.mockResolvedValue('watch');

    renderHook(() => useWatchHr());

    await waitFor(() => {
      expect(useHrSourceStore.getState().primary).toBe('watch');
      expect(useHrSourceStore.getState().hydrated).toBe(true);
    });
  });

  it('activates WatchConnectivity on mount to hydrate reachability state', () => {
    renderHook(() => useWatchHr());

    expect(getWatchConnectivityMock().activate).toHaveBeenCalledTimes(1);
  });

  describe('training phase transitions', () => {
    it('starts the stream when phase transitions to Active and primary is watch', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

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

    it('does not start the stream when phase transitions to Active but primary is not watch', async () => {
      useHrSourceStore.setState({ primary: null, hydrated: true });

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
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(new Error('WCSession activation failed')),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
        subscribeToActiveKcal: jest.fn().mockReturnValue({ remove: jest.fn() }),
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
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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

    it('stops the stream when primary changes away from watch mid-session', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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
        useHrSourceStore.setState({ primary: 'bluetooth' });
      });
      rerender({});

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
        expect(inst?.disconnect).toHaveBeenCalled();
      });
    });

    it('cancels a pending start when primary changes away from watch before connect resolves', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

      let resolveConnect: (() => void) | null = null;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      const disconnect = jest.fn().mockResolvedValue(undefined);
      const subscribeToHeartRate = jest.fn().mockReturnValue({ remove: jest.fn() });
      const subscribeToActiveKcal = jest.fn().mockReturnValue({ remove: jest.fn() });
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockImplementation(() => connectPromise),
        disconnect,
        subscribeToHeartRate,
        subscribeToActiveKcal,
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
        useHrSourceStore.setState({ primary: null });
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
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

      let resolveConnect: (() => void) | null = null;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      const disconnect = jest.fn().mockResolvedValue(undefined);
      const subscribeToHeartRate = jest.fn().mockReturnValue({ remove: jest.fn() });
      const subscribeToActiveKcal = jest.fn().mockReturnValue({ remove: jest.fn() });
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockImplementation(() => connectPromise),
        disconnect,
        subscribeToHeartRate,
        subscribeToActiveKcal,
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

  describe('active HR source lock', () => {
    it('locks activeHrSource to primary when Idle→Active', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('watch');
    });

    it('locks activeHrSource to bluetooth primary even though the watch stream is not started', async () => {
      useHrSourceStore.setState({ primary: 'bluetooth', hydrated: true });

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('bluetooth');

      // Watch stream must NOT have started for a non-watch primary
      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      expect(WatchHrAdapter.mock.instances).toHaveLength(0);
    });

    it('locks activeHrSource to bike primary', async () => {
      useHrSourceStore.setState({ primary: 'bike', hydrated: true });

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('bike');
    });

    it('unlocks activeHrSource (sets null) when session finishes', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Finished } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBeNull();
    });

    it('unlocks activeHrSource (sets null) when session goes to Idle', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Idle } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBeNull();
    });

    it('does not unlock activeHrSource during Active→Paused (lock persists through pause)', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());

      await act(async () => {
        await Promise.resolve();
      });

      // Verify lock was set
      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('watch');

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Paused } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      // Lock must persist through pause
      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('watch');
    });

    // Fix 1 regression guard: the lock must engage even when the Watch is not available
    // (Android, iPad, or iPhone with no paired watch). Previously the lock was inside the
    // `if (!watchAvailable) return;` guard, so it was never set on those platforms.
    it('locks and unlocks activeHrSource on platforms where Watch is not available', async () => {
      getIsAppleWatchAvailableMock().mockReturnValue(false);
      useHrSourceStore.setState({ primary: 'bike', hydrated: true });

      const { rerender } = renderHook(() => useWatchHr());

      // Idle→Active: lock must engage even without a Watch
      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('bike');

      // Finished: lock must clear
      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Finished } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBeNull();

      // Idle: also clears (covers the other unlock branch)
      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});
      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Idle } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBeNull();
    });

    // Fix 2: the lock deliberately tracks `primary` while Active so a mid-workout
    // primary change retargets the locked source. Pin this semantic so regressions
    // are caught (see comment in the lock effect in useWatchHr.ts).
    it('retargets the locked source when primary changes while Active (track-while-Active)', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('watch');

      // Change primary to bluetooth while still Active
      act(() => {
        useHrSourceStore.setState({ primary: 'bluetooth' });
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('bluetooth');
    });
  });

  describe('Watch pause/resume', () => {
    it('tells the Watch to pause when the workout pauses', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Paused } as never);
      });
      rerender({});

      await waitFor(() => {
        expect(getWatchConnectivityMock().pauseMirroredWorkout).toHaveBeenCalledTimes(1);
      });
    });

    it('tells the Watch to resume when the workout resumes from pause', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Paused } as never);
      });
      rerender({});
      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await waitFor(() => {
        expect(getWatchConnectivityMock().resumeMirroredWorkout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Watch reachability', () => {
    it('registers a reachability listener on mount', () => {
      renderHook(() => useWatchHr());
      expect(getWatchConnectivityMock().addListener).toHaveBeenCalledWith('onReachabilityChange', expect.any(Function));
    });

    it('keeps availability idle during the grace window after a brief reachability drop', () => {
      jest.useFakeTimers();
      try {
        useDeviceConnectionStore.setState({ watchAvailability: 'idle' });
        renderHook(() => useWatchHr());

        const wc = getWatchConnectivityMock();
        const reachabilityCallback = wc.addListener.mock.calls.find(
          ([eventName]: [string]) => eventName === 'onReachabilityChange',
        )?.[1] as ((payload: { reachable: boolean }) => void) | undefined;

        act(() => {
          reachabilityCallback?.({ reachable: false });
        });
        act(() => {
          jest.advanceTimersByTime(WATCH_REACHABILITY_GRACE_MS - 1);
        });
        // A dimmed Watch (brief blip) must not flap to unavailable within the window.
        expect(useDeviceConnectionStore.getState().watchAvailability).toBe('idle');

        // Reachability returning before the window elapses cancels the downgrade.
        act(() => {
          reachabilityCallback?.({ reachable: true });
        });
        act(() => {
          jest.advanceTimersByTime(WATCH_REACHABILITY_GRACE_MS);
        });
        expect(useDeviceConnectionStore.getState().watchAvailability).toBe('idle');
      } finally {
        jest.useRealTimers();
      }
    });

    it('falls to unavailable after a sustained reachability drop (app closed or suspended)', () => {
      jest.useFakeTimers();
      try {
        useDeviceConnectionStore.setState({ watchAvailability: 'idle' });
        renderHook(() => useWatchHr());

        const wc = getWatchConnectivityMock();
        const reachabilityCallback = wc.addListener.mock.calls.find(
          ([eventName]: [string]) => eventName === 'onReachabilityChange',
        )?.[1] as ((payload: { reachable: boolean }) => void) | undefined;

        act(() => {
          reachabilityCallback?.({ reachable: false });
        });
        act(() => {
          jest.advanceTimersByTime(WATCH_REACHABILITY_GRACE_MS);
        });

        expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
      } finally {
        jest.useRealTimers();
      }
    });

    it('preserves the active watch stream when reachability drops mid-workout', () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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
      const reachabilityCallback = wc.addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onReachabilityChange',
      )?.[1] as ((payload: { reachable: boolean }) => void) | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: true });
      });

      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(72);
    });

    it('upgrades availability to idle when the Watch becomes reachable from unavailable', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
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

    it('does not clobber an in-progress workout when reachability returns true', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'in_progress' });
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const reachabilityCallback = wc.addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onReachabilityChange',
      )?.[1] as ((payload: { reachable: boolean }) => void) | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: true });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('in_progress');
    });

    it('registers a companion-state listener on mount', () => {
      renderHook(() => useWatchHr());
      expect(getWatchConnectivityMock().addListener).toHaveBeenCalledWith(
        'onWatchCompanionStateChange',
        expect.any(Function),
      );
    });

    function getCompanionCallback() {
      return getWatchConnectivityMock().addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onWatchCompanionStateChange',
      )?.[1] as ((payload: { available: boolean }) => void) | undefined;
    }

    it('does not promote to idle on companion-available alone — reachability drives idle', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
      renderHook(() => useWatchHr());

      act(() => {
        getCompanionCallback()?.({ available: true });
      });

      // "installed" is not "running": an installed-but-closed companion must not read
      // as idle. Availability stays unavailable until the app is actually reachable.
      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
    });

    it('marks availability unavailable when the companion is not paired or installed', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'idle' });
      renderHook(() => useWatchHr());

      act(() => {
        getCompanionCallback()?.({ available: false });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
    });

    it('does not downgrade an in-progress workout when a companion-available event arrives', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'in_progress' });
      renderHook(() => useWatchHr());

      act(() => {
        getCompanionCallback()?.({ available: true });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('in_progress');
    });

    it('maps started session events to in_progress and ended to idle', () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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

    it('forwards Watch-computed active kcal into the device store', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      renderHook(() => useWatchHr());

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });

      const subscribeToActiveKcal = (WatchHrAdapter.mock.results[0]?.value as { subscribeToActiveKcal: jest.Mock })
        .subscribeToActiveKcal;
      const kcalCallback = subscribeToActiveKcal.mock.calls[0]?.[0] as ((kcal: number) => void) | undefined;

      act(() => {
        kcalCallback?.(42.5);
      });

      expect(useDeviceConnectionStore.getState().latestAppleWatchActiveKcal).toBe(42.5);
    });

    it('clears latestAppleWatchActiveKcal when the Watch goes out of range', () => {
      useDeviceConnectionStore.setState({ latestAppleWatchActiveKcal: 42.5 });
      renderHook(() => useWatchHr());

      const wc = getWatchConnectivityMock();
      const reachabilityCallback = wc.addListener.mock.calls[0]?.[1] as
        | ((payload: { reachable: boolean }) => void)
        | undefined;

      act(() => {
        reachabilityCallback?.({ reachable: false });
      });

      expect(useDeviceConnectionStore.getState().latestAppleWatchActiveKcal).toBeNull();
    });

    it('clears latestAppleWatchActiveKcal when the stream is stopped', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());

      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });

      const subscribeToActiveKcal = (WatchHrAdapter.mock.results[0]?.value as { subscribeToActiveKcal: jest.Mock })
        .subscribeToActiveKcal;
      const kcalCallback = subscribeToActiveKcal.mock.calls[0]?.[0] as ((kcal: number) => void) | undefined;

      act(() => {
        kcalCallback?.(30);
      });
      expect(useDeviceConnectionStore.getState().latestAppleWatchActiveKcal).toBe(30);

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Finished } as never);
      });
      rerender({});

      await waitFor(() => {
        expect(useDeviceConnectionStore.getState().latestAppleWatchActiveKcal).toBeNull();
      });
    });

    it('ignores stale watch session state events from before the current start request', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

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
    it('starts the stream immediately on mount when phase is Active and primary is watch', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
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

    it('does not start the stream on mount when phase is Active but primary is not watch', async () => {
      useHrSourceStore.setState({ primary: null, hydrated: true });
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
