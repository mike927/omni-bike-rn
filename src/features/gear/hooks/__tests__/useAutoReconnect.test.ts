import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAutoReconnect } from '../useAutoReconnect';
import { useAutoReconnectLifecycle } from '../useAutoReconnectLifecycle';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { ConnectInProgressError } from '../../../../services/ble/ConnectInProgressError';

const mockAppStateListeners: ((nextState: 'active' | 'background' | 'inactive') => void)[] = [];

jest.mock('../../../../services/gear/gearStorage');
jest.mock('../../../../features/training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => ({
    connectBike: mockConnectBike,
    connectHr: mockConnectHr,
    disconnectBike: mockDisconnectBike,
    disconnectHr: mockDisconnectHr,
    disconnectAll: jest.fn(),
    bikeConnected: false,
    hrConnected: false,
    latestBikeMetrics: null,
    latestBluetoothHr: null,
  }),
  connectBikeDevice: (...args: unknown[]) => mockConnectBike(...args),
  connectHrDevice: (...args: unknown[]) => mockConnectHr(...args),
  disconnectBikeDevice: () => mockDisconnectBike(),
  disconnectHrDevice: () => mockDisconnectHr(),
}));

const mockConnectBike = jest.fn();
const mockConnectHr = jest.fn();
const mockDisconnectBike = jest.fn();
const mockDisconnectHr = jest.fn();

const bike = { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' as const };
const hr = { id: 'hr-uuid', name: 'Garmin HRM', type: 'hr' as const };

function emitAppStateChange(nextState: 'active' | 'background' | 'inactive') {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: nextState,
  });
  for (const listener of [...mockAppStateListeners]) {
    listener(nextState);
  }
}

/**
 * Mount the app as it really is: one root-owned reconnect lifecycle plus a
 * screen reading it. The assertions below are about the policy, so both halves
 * live in one tree here; `reconnectOwnership.test.ts` is the suite that renders
 * them separately.
 */
function renderAutoReconnect() {
  return renderHook(() => {
    useAutoReconnectLifecycle();
    return useAutoReconnect();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.useRealTimers();
  mockAppStateListeners.splice(0, mockAppStateListeners.length);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((eventType, listener) => {
    if (eventType !== 'change') {
      return { remove: () => {} } as never;
    }

    const typedListener = listener as (nextState: AppStateStatus) => void;
    mockAppStateListeners.push(typedListener);

    return {
      remove: () => {
        const index = mockAppStateListeners.indexOf(typedListener);
        if (index >= 0) {
          mockAppStateListeners.splice(index, 1);
        }
      },
    };
  });
  emitAppStateChange('active');
  useDeviceConnectionStore.setState({
    bikeAdapter: null,
    hrAdapter: null,
    bikeConnectionInProgress: false,
    hrConnectionInProgress: false,
    latestBikeMetrics: null,
    latestBluetoothHr: null,
    latestAppleWatchHr: null,
  });
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: null,
    hydrated: false,
    bikeReconnectState: 'idle',
    hrReconnectState: 'idle',
    bikeAutoReconnectSuppressed: false,
    hrAutoReconnectSuppressed: false,
  });
  mockConnectBike.mockImplementation(() => {
    useDeviceConnectionStore.setState({ bikeAdapter: {} as never });
    return Promise.resolve();
  });
  mockConnectHr.mockImplementation(() => {
    useDeviceConnectionStore.setState({ hrAdapter: {} as never });
    return Promise.resolve();
  });
  mockDisconnectBike.mockImplementation(() => {
    useDeviceConnectionStore.setState({ bikeAdapter: null });
    return Promise.resolve();
  });
  mockDisconnectHr.mockImplementation(() => {
    useDeviceConnectionStore.setState({ hrAdapter: null });
    return Promise.resolve();
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('auto-reconnect on mount', () => {
  it('reconnects bike when hydrated and saved bike exists with no active adapter', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    expect(['connecting', 'connected']).toContain(result.current.bikeReconnectState);

    await waitFor(() => {
      expect(result.current.bikeReconnectState).toBe('connected');
    });

    expect(mockConnectBike).toHaveBeenCalledWith('bike-uuid');
    expect(result.current.bikeReconnectState).toBe('connected');
  });

  it('reconnects HR when hydrated and saved HR source exists', async () => {
    useSavedGearStore.setState({ savedHrSource: hr, hydrated: true });

    const { result } = await renderAutoReconnect();

    expect(['connecting', 'connected']).toContain(result.current.hrReconnectState);

    await waitFor(() => {
      expect(result.current.hrReconnectState).toBe('connected');
    });

    expect(mockConnectHr).toHaveBeenCalledWith('hr-uuid');
    expect(result.current.hrReconnectState).toBe('connected');
  });

  it('does not reconnect if not yet hydrated', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: false });

    await renderAutoReconnect();

    expect(mockConnectBike).not.toHaveBeenCalled();
  });

  it('does not reconnect if adapter already active', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });
    useDeviceConnectionStore.setState({ bikeAdapter: {} as never });

    await renderAutoReconnect();

    expect(mockConnectBike).not.toHaveBeenCalled();
  });

  it('does not reconnect automatically when bike auto-reconnect is suppressed', async () => {
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'disconnected',
      bikeAutoReconnectSuppressed: true,
    });

    await renderAutoReconnect();

    expect(mockConnectBike).not.toHaveBeenCalled();
  });

  // The test above runs on real timers and returns before the scheduler's 0 ms
  // probe could fire, so it never observes the scheduler's suppression guard.
  // This one advances the clock through the whole cycle, which is what makes
  // "suppression stops the probes" an assertion rather than a coincidence.
  it('dials no probe at all while bike auto-reconnect is suppressed', async () => {
    jest.useFakeTimers();
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'disconnected',
      bikeAutoReconnectSuppressed: true,
    });

    await renderAutoReconnect();

    // Probe 1 would be immediate.
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(mockConnectBike).not.toHaveBeenCalled();

    // And probes 2 and 3 would land inside this window.
    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });
    expect(mockConnectBike).not.toHaveBeenCalled();
  });

  // Suppression has to hold on the other entry point too: a cycle sitting at
  // `idle` (nothing has been tried yet) is dialled by the auto-connect step, not
  // by the scheduler.
  it('does not auto-connect an idle bike cycle while suppression is in force', async () => {
    jest.useFakeTimers();
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'idle',
      bikeAutoReconnectSuppressed: true,
    });

    await renderAutoReconnect();

    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(mockConnectBike).not.toHaveBeenCalled();
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('idle');
  });

  it('does not auto-connect an idle HR cycle while suppression is in force', async () => {
    jest.useFakeTimers();
    useSavedGearStore.setState({
      savedHrSource: hr,
      hydrated: true,
      hrReconnectState: 'idle',
      hrAutoReconnectSuppressed: true,
    });

    await renderAutoReconnect();

    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(mockConnectHr).not.toHaveBeenCalled();
    expect(useSavedGearStore.getState().hrReconnectState).toBe('idle');
  });
});

describe('failed state', () => {
  it('sets bikeReconnectState to failed on connection error', async () => {
    mockConnectBike.mockRejectedValue(new Error('BLE error'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    await waitFor(() => {
      expect(result.current.bikeReconnectState).toBe('failed');
    });

    expect(result.current.bikeReconnectState).toBe('failed');
  });

  // Anchors the log line the transient-error tests below assert the ABSENCE of:
  // without a positive case, a renamed prefix would make all of them vacuous.
  it('logs a hard bike connect failure once, from the reconnect owner', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const hardError = new Error('BLE error');

    mockConnectBike.mockRejectedValue(hardError);
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    await waitFor(() => {
      expect(result.current.bikeReconnectState).toBe('failed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[reconnectController] Bike connect failed:', hardError);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it('treats cancelled reconnect attempts as a transient retry without logging an error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cancelledError = Object.assign(new Error('Operation was cancelled'), {
      errorCode: 2,
    });

    mockConnectBike.mockRejectedValue(cancelledError);
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    // Transient failure keeps the cycle alive (still "connecting"), not a hard failure.
    await waitFor(() => {
      expect(useSavedGearStore.getState().bikeReconnectState).toBe('connecting');
    });

    expect(result.current.bikeReconnectState).toBe('connecting');
    expect(consoleErrorSpy).not.toHaveBeenCalledWith('[reconnectController] Bike connect failed:', cancelledError);

    consoleErrorSpy.mockRestore();
  });

  it('treats connection timeouts as a transient retry without logging an error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const timeoutError = new Error('Operation timed out');

    mockConnectBike.mockRejectedValue(timeoutError);
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    // Transient timeout keeps the cycle alive (still "connecting"), not a hard failure.
    await waitFor(() => {
      expect(result.current.bikeReconnectState).toBe('connecting');
    });

    expect(result.current.bikeReconnectState).toBe('connecting');
    expect(consoleErrorSpy).not.toHaveBeenCalledWith('[reconnectController] Bike connect failed:', timeoutError);

    consoleErrorSpy.mockRestore();
  });

  it('treats ConnectInProgressError as a transient retry (disconnected), not a hard failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const busyError = new ConnectInProgressError('bike');

    mockConnectBike.mockRejectedValue(busyError);
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    // A busy signal is transient — keeps the cycle alive, not a hard failure.
    await waitFor(() => {
      expect(result.current.bikeReconnectState).toBe('connecting');
    });

    expect(result.current.bikeReconnectState).toBe('connecting');
    expect(consoleErrorSpy).not.toHaveBeenCalledWith('[reconnectController] Bike connect failed:', busyError);

    consoleErrorSpy.mockRestore();
  });

  it('marks bike as disconnected when the adapter disappears after a successful connect', async () => {
    jest.useFakeTimers();
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'connected',
    });
    useDeviceConnectionStore.setState({ bikeAdapter: {} as never });

    const { result } = await renderAutoReconnect();

    await act(() => {
      useDeviceConnectionStore.setState({ bikeAdapter: null });
    });

    expect(result.current.bikeReconnectState).toBe('disconnected');

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(mockConnectBike).toHaveBeenCalledWith('bike-uuid');
    expect(result.current.bikeReconnectState).toBe('connected');
  });

  it('does not mark the bike disconnected or schedule auto-retry while another bike connect is still in flight', async () => {
    jest.useFakeTimers();
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'connected',
    });
    useDeviceConnectionStore.setState({ bikeConnectionInProgress: true });

    const { result } = await renderAutoReconnect();

    await act(() => {
      useDeviceConnectionStore.setState({ bikeAdapter: null });
    });

    expect(result.current.bikeReconnectState).toBe('connected');

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockConnectBike).not.toHaveBeenCalled();

    await act(() => {
      useDeviceConnectionStore.setState({ bikeConnectionInProgress: false });
    });

    expect(result.current.bikeReconnectState).toBe('disconnected');
  });
});

describe('retry', () => {
  it('retryBike triggers a fresh reconnect attempt from failed state', async () => {
    let resolveConnect!: () => void;
    mockConnectBike.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = () => {
            useDeviceConnectionStore.setState({ bikeAdapter: {} as never });
            resolve();
          };
        }),
    );
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'failed',
    });

    const { result } = await renderAutoReconnect();

    await act(() => {
      result.current.retryBike();
    });

    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connecting');

    await act(async () => {
      resolveConnect();
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
  });

  it('retryBike clears manual suppression before reconnecting again', async () => {
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'disconnected',
      bikeAutoReconnectSuppressed: true,
    });

    const { result } = await renderAutoReconnect();

    await act(() => {
      result.current.retryBike();
    });

    await waitFor(() => {
      expect(mockConnectBike).toHaveBeenCalledWith('bike-uuid');
    });

    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(false);
    expect(mockConnectBike).toHaveBeenCalledWith('bike-uuid');
  });

  it('retryBike ignores repeated presses while a reconnect attempt is already in flight', async () => {
    let resolveConnect!: () => void;
    mockConnectBike.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = () => {
            useDeviceConnectionStore.setState({ bikeAdapter: {} as never });
            resolve();
          };
        }),
    );
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'failed',
    });

    const { result } = await renderAutoReconnect();

    await act(() => {
      result.current.retryBike();
      result.current.retryBike();
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connecting');

    await act(async () => {
      resolveConnect();
    });

    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
  });

  it('disconnects a stale bike reconnect when the saved device is forgotten mid-attempt', async () => {
    let resolveConnect!: () => void;
    mockConnectBike.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = () => {
            useDeviceConnectionStore.setState({ bikeAdapter: {} as never });
            resolve();
          };
        }),
    );
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'failed',
    });

    const { result } = await renderAutoReconnect();

    await act(() => {
      result.current.retryBike();
    });

    await act(() => {
      useSavedGearStore.setState({
        savedBike: null,
        bikeReconnectState: 'idle',
      });
    });

    await act(async () => {
      resolveConnect();
    });

    expect(mockDisconnectBike).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('idle');
    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
  });

  it('disconnects a stale HR reconnect when the saved source is forgotten mid-attempt', async () => {
    let resolveConnect!: () => void;
    mockConnectHr.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = () => {
            useDeviceConnectionStore.setState({ hrAdapter: {} as never });
            resolve();
          };
        }),
    );
    useSavedGearStore.setState({
      savedHrSource: hr,
      hydrated: true,
      hrReconnectState: 'failed',
    });

    const { result } = await renderAutoReconnect();

    await act(() => {
      result.current.retryHr();
    });

    await act(() => {
      useSavedGearStore.setState({
        savedHrSource: null,
        hrReconnectState: 'idle',
      });
    });

    await act(async () => {
      resolveConnect();
    });

    expect(mockDisconnectHr).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().hrReconnectState).toBe('idle');
    expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
  });

  it('probes on the immediate / +3s / +5s cadence while the app is active', async () => {
    jest.useFakeTimers();
    mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await renderAutoReconnect();

    // Probe 1 fired immediately on mount; flush its failure so probe 2 is scheduled.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connecting');

    // Probe 2 — at +3s (nothing at 2999 ms).
    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
    // Stays "connecting" in the gap — budget not yet spent.
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connecting');

    // Probe 3 — at +5s after probe 2 (nothing at 4999 ms).
    await act(async () => {
      jest.advanceTimersByTime(4999);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(3);
  });

  it('stops auto-reconnect after 3 probes (immediate, +3s, +5s) and stays disconnected', async () => {
    jest.useFakeTimers();
    mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await renderAutoReconnect();

    // Probe 1 — immediate (on mount); flush its failure so probe 2 is scheduled.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connecting');

    // Probe 2 — after 3s
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(2);

    // Probe 3 — after a further 5s
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(3);

    // Budget exhausted — no 4th probe ever, device left disconnected (Unavailable).
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(3);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
  });

  it('resets the bike retry backoff after a manual bike connection succeeds', async () => {
    jest.useFakeTimers();
    mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    // Probe 1 on mount; flush its failure so probe 2 is scheduled.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    expect(result.current.bikeReconnectState).toBe('connecting');

    // Probe 2 — after 3s
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
    expect(result.current.bikeReconnectState).toBe('connecting');

    // A successful connect (adapter appears) resets the probe budget.
    await act(() => {
      useDeviceConnectionStore.setState({ bikeAdapter: {} as never });
    });

    expect(result.current.bikeReconnectState).toBe('connected');

    // The adapter drops again → a fresh cycle.
    await act(() => {
      useDeviceConnectionStore.setState({ bikeAdapter: null });
    });

    expect(result.current.bikeReconnectState).toBe('disconnected');

    // Budget was reset by the successful connect, so probe 1 of the new cycle fires immediately.
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(3);
  });

  // The test above drives the reset through the adopt step, because a real
  // connect publishes its adapter and adoption resets the budget too. This one
  // isolates the probe's own reset: the connect resolves without an adapter
  // appearing, so adoption never runs and only the success path can hand the
  // next cycle a full budget.
  it('resets the probe budget from the probe that succeeded, not only through adoption', async () => {
    jest.useFakeTimers();
    mockConnectBike
      .mockRejectedValueOnce(new Error('Operation timed out'))
      .mockRejectedValueOnce(new Error('Operation timed out'))
      .mockResolvedValueOnce(undefined)
      .mockImplementation(() => new Promise<void>(() => {}));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    // Probes 1 and 2 fail, so two of the three probes are spent.
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(2);

    // Probe 3 succeeds. With no adapter published, the connection reads as lost
    // again on the next pass and a fresh cycle starts.
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(3);
    expect(result.current.bikeReconnectState).toBe('disconnected');

    // A full budget means probe 1 of that cycle is immediate. Without the reset
    // it would be probe 3's 5 s wait instead.
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(4);
  });

  it('restores the full probe budget when Retry is pressed after the budget is spent', async () => {
    jest.useFakeTimers();
    mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    // Spend all three probes.
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(3);
    expect(result.current.bikeReconnectState).toBe('disconnected');

    // Retry dials at once...
    await act(async () => {
      result.current.retryBike();
      await Promise.resolve();
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(4);

    // ...and the cycle it starts still has probes 2 and 3 to spend.
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(5);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(6);
  });

  it('does not auto-retry while the app is backgrounded and resumes when active again', async () => {
    jest.useFakeTimers();
    mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await renderAutoReconnect();

    await waitFor(() => {
      expect(mockConnectBike).toHaveBeenCalledTimes(1);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(() => {
      emitAppStateChange('background');
    });

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(() => {
      emitAppStateChange('active');
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(2);
  });
});

describe('adapter appeared externally', () => {
  it('treats adapter availability as a successful connect even if the original promise never resolves', async () => {
    mockConnectBike.mockImplementation(
      () =>
        new Promise<void>(() => {
          useDeviceConnectionStore.setState({ bikeAdapter: {} as never });
        }),
    );
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = await renderAutoReconnect();

    await waitFor(() => {
      expect(result.current.bikeReconnectState).toBe('connected');
    });

    expect(result.current.bikeReconnectState).toBe('connected');
  });
});
