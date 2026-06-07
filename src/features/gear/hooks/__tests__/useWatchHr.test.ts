import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useWatchHr } from '../useWatchHr';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { useHrSourceStore } from '../../../../store/hrSourceStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { TrainingPhase } from '../../../../types/training';
import { HR_NO_SIGNAL_TIMEOUT_MS } from '../../../../services/hr/hrSource';

// ── Module mocks ──────────────────────────────────────────────────────────────

type NativeWatchSessionStatePayload = { state: 'started' | 'ended' | 'failed'; sentAtMs: number };

jest.mock('watch-connectivity', () => ({
  WatchConnectivity: {
    activate: jest.fn(),
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
  useSavedGearStore.setState({ savedHrSource: null });
}

const SAVED_STRAP = { id: 'strap-1', name: 'Polar H10' } as never;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetStores();

  const wc = getWatchConnectivityMock();
  wc.activate.mockResolvedValue(undefined);
  wc.addListener.mockReturnValue({ remove: jest.fn() });
  wc.pauseMirroredWorkout.mockResolvedValue(undefined);
  wc.resumeMirroredWorkout.mockResolvedValue(undefined);

  const prefs = getAppPreferencesMock();
  prefs.loadPrimaryHrSource.mockResolvedValue(null);
  prefs.setPrimaryHrSource.mockResolvedValue(undefined);

  getIsAppleWatchAvailableMock().mockReturnValue(true);

  // RN's jest preset stubs AppState.currentState as a jest.fn(); the mid-ride
  // reachability retry gates on it being 'active', so default it to foreground.
  AppState.currentState = 'active';
});

afterEach(() => {
  jest.useRealTimers();
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

    it('starts the stream when phase transitions to Active and the Watch is the effective default (no explicit primary)', async () => {
      // Finding #1: a user who never picked a source resolves to the Watch
      // default (watch is connected), so the lifecycle must start the stream.
      useHrSourceStore.setState({ primary: null, hydrated: true });
      useDeviceConnectionStore.setState({ watchAvailability: 'connected' });

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await waitFor(() => {
        const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
          WatchHrAdapter: jest.Mock;
        };
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });
      expect(useDeviceConnectionStore.getState().activeHrSource).toBe('watch');
    });

    it('does not start the stream before the primary preference has hydrated', async () => {
      // Pre-hydration tolerance: even with the Watch connected, no stream starts
      // until the persisted preference resolves (avoids a premature connect that
      // a non-watch primary would immediately tear down). Hold hydration open so
      // `hydrated` stays false for the duration of the assertion.
      getAppPreferencesMock().loadPrimaryHrSource.mockReturnValue(new Promise<never>(() => {}));
      useHrSourceStore.setState({ primary: null, hydrated: false });
      useDeviceConnectionStore.setState({ watchAvailability: 'connected' });

      const { rerender } = renderHook(() => useWatchHr());

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      expect(useHrSourceStore.getState().hydrated).toBe(false);
      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };
      expect(WatchHrAdapter.mock.instances).toHaveLength(0);
    });

    it('does not start the stream when phase transitions to Active but the effective primary is not watch', async () => {
      useHrSourceStore.setState({ primary: 'bike', hydrated: true });

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

    it('tears down the Watch stream on Finish even after primary changed away from watch while paused', async () => {
      // Finding #2: pausing a Watch ride, switching primary away, then finishing
      // must still end the mirrored workout — teardown is not gated on the
      // mutable current primary.
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useSavedGearStore.setState({ savedHrSource: SAVED_STRAP });
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
      act(() => {
        useHrSourceStore.setState({ primary: 'bluetooth' });
      });
      rerender({});
      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Finished } as never);
      });
      rerender({});

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { disconnect: jest.Mock } | undefined;
        expect(inst?.disconnect).toHaveBeenCalled();
      });
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
      // A bluetooth primary is only valid while its strap is saved (finding #3).
      useHrSourceStore.setState({ primary: 'bluetooth', hydrated: true });
      useSavedGearStore.setState({ savedHrSource: SAVED_STRAP });

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
      // Bluetooth is only a valid retarget while its strap is saved (finding #3).
      useSavedGearStore.setState({ savedHrSource: SAVED_STRAP });

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

    it('coalesces a rapid pause/resume spam into a single final command (debounce)', async () => {
      // A rapid Active⇄Paused toggle used to fire a pause/resume on every transition,
      // flooding the Watch and (via a session.pause()-while-paused race) killing its
      // HKWorkoutSession. The phone now debounces so only the settled, final intent is sent.
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const { rerender } = renderHook(() => useWatchHr());
      await act(async () => {
        await Promise.resolve();
      });

      const wc = getWatchConnectivityMock();
      wc.pauseMirroredWorkout.mockClear();
      wc.resumeMirroredWorkout.mockClear();

      // Spam faster than the debounce window, ending on Active (final intent = resume).
      const spam = [TrainingPhase.Paused, TrainingPhase.Active, TrainingPhase.Paused, TrainingPhase.Active];
      for (const next of spam) {
        act(() => {
          useTrainingSessionStore.setState({ phase: next } as never);
        });
        rerender({});
      }

      await act(async () => {
        jest.advanceTimersByTime(1_000);
        await Promise.resolve();
      });

      // Exactly one command, matching the final phase; the intermediate toggles are dropped.
      expect(wc.resumeMirroredWorkout).toHaveBeenCalledTimes(1);
      expect(wc.pauseMirroredWorkout).toHaveBeenCalledTimes(0);
    });
  });

  describe('Watch availability — companion-presence model', () => {
    function getReachabilityCallback() {
      return getWatchConnectivityMock().addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onReachabilityChange',
      )?.[1] as ((payload: { reachable: boolean }) => void) | undefined;
    }

    function getSessionStateCallback() {
      return getWatchConnectivityMock().addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onWatchSessionState',
      )?.[1] as ((payload: NativeWatchSessionStatePayload) => void) | undefined;
    }

    function getCompanionCallback() {
      return getWatchConnectivityMock().addListener.mock.calls.find(
        ([eventName]: [string]) => eventName === 'onWatchCompanionStateChange',
      )?.[1] as ((payload: { available: boolean }) => void) | undefined;
    }

    it('registers all expected listeners on mount', () => {
      renderHook(() => useWatchHr());
      const wc = getWatchConnectivityMock();
      expect(wc.addListener).toHaveBeenCalledWith('onReachabilityChange', expect.any(Function));
      expect(wc.addListener).toHaveBeenCalledWith('onWatchCompanionStateChange', expect.any(Function));
      expect(wc.addListener).toHaveBeenCalledWith('onWatchSessionState', expect.any(Function));
      expect(wc.addListener).toHaveBeenCalledWith('onWatchAppState', expect.any(Function));
    });

    it('companion available=true → watchAvailability becomes connected', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
      renderHook(() => useWatchHr());

      act(() => {
        getCompanionCallback()?.({ available: true });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('connected');
    });

    it('companion available=false → watchAvailability becomes unavailable', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'connected' });
      renderHook(() => useWatchHr());

      act(() => {
        getCompanionCallback()?.({ available: false });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
    });

    it('reachability change does NOT change watchAvailability (only companion does)', () => {
      useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
      renderHook(() => useWatchHr());

      act(() => {
        getReachabilityCallback()?.({ reachable: true });
      });

      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
    });

    it('HR sample does NOT change watchAvailability', async () => {
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

      // HR sample must update the HR reading but must NOT touch availability
      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(147);
      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
    });

    it('ignores stale watch session state events from before the current start request', async () => {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });

      const { rerender } = renderHook(() => useWatchHr());

      const staleSentAtMs = Date.now() - 10_000;

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      });
      rerender({});

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        getSessionStateCallback()?.({ state: 'started', sentAtMs: staleSentAtMs });
      });

      // Stale event must not change availability
      expect(useDeviceConnectionStore.getState().watchAvailability).toBe('unavailable');
    });

    it('does not clear latestAppleWatchHr when reachability changes', () => {
      useDeviceConnectionStore.setState({ latestAppleWatchHr: 72 });
      renderHook(() => useWatchHr());

      act(() => {
        getReachabilityCallback()?.({ reachable: false });
      });
      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(72);

      act(() => {
        getReachabilityCallback()?.({ reachable: true });
      });
      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(72);
    });

    it('retries the HR stream when the Watch becomes reachable mid-ride', async () => {
      // While Active + watch primary, a reachable=true event must re-invoke startStream when
      // adapterRef is null (stream dropped). To manufacture that state: make the first connect
      // fail so startingRef resets to false and adapterRef stays null, then fire reachable=true.
      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      // First connect attempt fails — leaves adapterRef null, startingRef false.
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Watch dropped')),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
        subscribeToActiveKcal: jest.fn().mockReturnValue({ remove: jest.fn() }),
      }));

      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      renderHook(() => useWatchHr());

      // Wait for the failing connect to settle (adapterRef stays null, startingRef resets).
      await waitFor(() => {
        expect(WatchHrAdapter.mock.instances).toHaveLength(1);
      });
      const connectAfterFirstAttempt = (WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock }).connect;
      await waitFor(() => {
        expect(connectAfterFirstAttempt).toHaveBeenCalledTimes(1);
      });

      const constructionCountBeforeRetry = WatchHrAdapter.mock.instances.length; // 1

      // Reachability=true fires while phase=Active, primary='watch', adapterRef=null → retry.
      await act(async () => {
        getReachabilityCallback()?.({ reachable: true });
        await Promise.resolve();
      });

      // A new WatchHrAdapter must have been constructed (retry fired startStream).
      await waitFor(() => {
        expect(WatchHrAdapter.mock.instances.length).toBeGreaterThan(constructionCountBeforeRetry);
      });
    });

    it('does not retry the HR stream on reachability while the iPhone app is backgrounded (M-01)', async () => {
      // startWatchApp cannot launch the Watch app from the background, so a
      // reachability re-wake there is a doomed, error-logging probe — skip it.
      const { WatchHrAdapter } = jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
        WatchHrAdapter: jest.Mock;
      };

      // First connect fails → adapterRef stays null, startingRef resets (stream dropped).
      WatchHrAdapter.mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Watch dropped')),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
        subscribeToActiveKcal: jest.fn().mockReturnValue({ remove: jest.fn() }),
      }));

      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      renderHook(() => useWatchHr());

      await waitFor(() => {
        expect(WatchHrAdapter.mock.instances).toHaveLength(1);
      });
      const constructionCountBeforeRetry = WatchHrAdapter.mock.instances.length; // 1

      // App is backgrounded when the Watch becomes reachable again.
      AppState.currentState = 'background';
      await act(async () => {
        getReachabilityCallback()?.({ reachable: true });
        await Promise.resolve();
      });

      // No re-wake attempted: no new adapter constructed.
      expect(WatchHrAdapter.mock.instances).toHaveLength(constructionCountBeforeRetry);
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

    it('does not start the stream on mount when the effective default is not watch (no primary, Watch unavailable)', async () => {
      // No explicit primary + Watch unavailable → default resolves to bike, not watch.
      useHrSourceStore.setState({ primary: null, hydrated: true });
      useDeviceConnectionStore.setState({ watchAvailability: 'unavailable' });
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

  describe('mid-ride HR drop recovery (T-03)', () => {
    function getWatchHrAdapterMock() {
      return (
        jest.requireMock('../../../../services/watch/WatchHrAdapter') as {
          WatchHrAdapter: jest.Mock;
        }
      ).WatchHrAdapter;
    }

    // Drive a watch-primary Active ride to a live stream and deliver one HR sample,
    // so `lastAppleWatchSampleAtMs` is set (the stream is "established and producing").
    async function startLiveWatchStreamAndDeliverSample() {
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);

      const view = renderHook(() => useWatchHr());
      const WatchHrAdapter = getWatchHrAdapterMock();

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });

      const subscribeToHeartRate = (WatchHrAdapter.mock.results[0]?.value as { subscribeToHeartRate: jest.Mock })
        .subscribeToHeartRate;
      const hrCallback = subscribeToHeartRate.mock.calls[0]?.[0] as ((hr: number) => void) | undefined;
      act(() => {
        hrCallback?.(150);
      });
      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(150);

      return view;
    }

    it('reconnects when an established HR stream goes silent past the freshness window', async () => {
      await startLiveWatchStreamAndDeliverSample();
      const WatchHrAdapter = getWatchHrAdapterMock();
      const adaptersBeforeDrop = WatchHrAdapter.mock.instances.length; // 1 — the live stream

      // The Watch drops silently (no disconnect event), so the stream goes quiet.
      // Once the silence exceeds the freshness window the drop watchdog must treat
      // the (still non-null) adapter as dropped and reconnect — building a new adapter.
      await act(async () => {
        jest.advanceTimersByTime(HR_NO_SIGNAL_TIMEOUT_MS + 10_000);
        await Promise.resolve();
      });

      expect(WatchHrAdapter.mock.instances.length).toBeGreaterThan(adaptersBeforeDrop);
    });

    it('does not reconnect on silence while Paused (pause silence is legitimate, not a drop)', async () => {
      const { rerender } = await startLiveWatchStreamAndDeliverSample();
      const WatchHrAdapter = getWatchHrAdapterMock();
      const adaptersBeforePause = WatchHrAdapter.mock.instances.length;

      act(() => {
        useTrainingSessionStore.setState({ phase: TrainingPhase.Paused } as never);
      });
      rerender({});

      // HR collection is suspended while paused, so the stream is silent by design.
      await act(async () => {
        jest.advanceTimersByTime(HR_NO_SIGNAL_TIMEOUT_MS + 10_000);
        await Promise.resolve();
      });

      expect(WatchHrAdapter.mock.instances.length).toBe(adaptersBeforePause);
    });

    it('backs off between drop reconnects — no per-tick storm while still silent', async () => {
      await startLiveWatchStreamAndDeliverSample();
      const WatchHrAdapter = getWatchHrAdapterMock();
      const before = WatchHrAdapter.mock.instances.length; // 1

      // First stretch of silence past the window → exactly one reconnect (not one per tick).
      await act(async () => {
        jest.advanceTimersByTime(HR_NO_SIGNAL_TIMEOUT_MS + 10_000);
        await Promise.resolve();
      });
      expect(WatchHrAdapter.mock.instances.length).toBe(before + 1);

      // The reconnect's stream also stays silent (no new sample delivered). Advancing
      // less than another freshness window must NOT reconnect again — the backoff holds.
      await act(async () => {
        jest.advanceTimersByTime(5_000);
        await Promise.resolve();
      });
      expect(WatchHrAdapter.mock.instances.length).toBe(before + 1);
    });

    it('does not reconnect before the first sample arrives (Connecting…, not a drop)', async () => {
      // adapterRef is set (connect resolved) but no HR sample has landed yet, so
      // lastAppleWatchSampleAtMs stays null. That is the "Connecting…" state — owned by
      // the reachability retry — not a drop, so the watchdog must leave it alone.
      useHrSourceStore.setState({ primary: 'watch', hydrated: true });
      useTrainingSessionStore.setState({ phase: TrainingPhase.Active } as never);
      renderHook(() => useWatchHr());
      const WatchHrAdapter = getWatchHrAdapterMock();

      await waitFor(() => {
        const inst = WatchHrAdapter.mock.results[0]?.value as { connect: jest.Mock } | undefined;
        expect(inst?.connect).toHaveBeenCalled();
      });
      const before = WatchHrAdapter.mock.instances.length; // 1, no sample delivered

      await act(async () => {
        jest.advanceTimersByTime(HR_NO_SIGNAL_TIMEOUT_MS * 3);
        await Promise.resolve();
      });

      expect(WatchHrAdapter.mock.instances.length).toBe(before);
    });
  });
});
