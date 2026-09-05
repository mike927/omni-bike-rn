import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDeviceConnection } from '../useDeviceConnection';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { ConnectInProgressError } from '../../../../services/ble/ConnectInProgressError';
import { bleManager } from '../../../../services/ble/bleClient';
import { hrSourceIdleReadiness } from '../../../../services/hr/hrStatus';

jest.mock('../../../../services/ble/bleClient', () => ({
  bleManager: { onDeviceDisconnected: jest.fn() },
}));

const mockOnDeviceDisconnected = jest.mocked(bleManager.onDeviceDisconnected);

/**
 * One registered native disconnection observer, so tests can fire and inspect it.
 *
 * `remove()` really deregisters here, the way a ble-plx `Subscription` does. A
 * no-op stub would let every test fire listeners the app has already released,
 * which turns "the observer was disposed in time" into an untestable claim.
 */
interface RegisteredDisconnectObserver {
  readonly deviceId: string;
  removed: boolean;
  /** Hand the event to the listener, whatever the subscription's state. */
  readonly invoke: () => void;
  readonly remove: jest.Mock;
}

const disconnectObservers: RegisteredDisconnectObserver[] = [];

/** Observers registered for `deviceId`, oldest first. */
function observersFor(deviceId: string): RegisteredDisconnectObserver[] {
  return disconnectObservers.filter((observer) => observer.deviceId === deviceId);
}

function latestObserverFor(deviceId: string): RegisteredDisconnectObserver {
  const observer = observersFor(deviceId).at(-1);
  if (!observer) {
    throw new Error(`No native disconnect observer registered for ${deviceId}`);
  }
  return observer;
}

/**
 * Emit a native disconnection for `deviceId`, the way react-native-ble-plx does
 * when a peripheral drops off the air.
 *
 * A removed subscription no longer receives events, so this is inert once the
 * app has released the observer. That is the point: it is how a test can tell
 * whether the app disarmed itself in time.
 */
function emitNativeDisconnect(deviceId: string): void {
  const observer = latestObserverFor(deviceId);
  if (observer.removed) {
    return;
  }
  observer.invoke();
}

/**
 * Deliver an event that was already in flight when the subscription was removed.
 *
 * That race is the only reason the adapter identity guard exists, so it is the
 * only way a test may reach a listener the app has deregistered.
 */
function emitLateNativeDisconnect(deviceId: string): void {
  const observer = latestObserverFor(deviceId);
  if (!observer.removed) {
    throw new Error(`The native disconnect observer for ${deviceId} is still live; use emitNativeDisconnect`);
  }
  observer.invoke();
}

const mockBikeConnect = jest.fn();
const mockBikeDisconnect = jest.fn();
const mockBikeSubscribe = jest.fn();
const mockHrConnect = jest.fn();
const mockHrDisconnect = jest.fn();
const mockHrSubscribe = jest.fn();

jest.mock('../../../../services/ble/ZiproRaveAdapter', () => ({
  ZiproRaveAdapter: jest.fn().mockImplementation(() => ({
    connect: mockBikeConnect,
    disconnect: mockBikeDisconnect,
    subscribeToMetrics: mockBikeSubscribe,
    setControlState: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../../services/ble/StandardHrAdapter', () => ({
  StandardHrAdapter: jest.fn().mockImplementation(() => ({
    connect: mockHrConnect,
    disconnect: mockHrDisconnect,
    subscribeToHeartRate: mockHrSubscribe,
  })),
}));

describe('useDeviceConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disconnectObservers.length = 0;
    mockOnDeviceDisconnected.mockImplementation((deviceId, listener) => {
      const observer: RegisteredDisconnectObserver = {
        deviceId,
        removed: false,
        invoke: () => listener(null, null),
        remove: jest.fn(() => {
          observer.removed = true;
        }),
      };
      disconnectObservers.push(observer);
      return { remove: observer.remove };
    });
    useDeviceConnectionStore.getState().clearAll();
    useSavedGearStore.setState({
      savedBike: null,
      savedHrSource: null,
      hydrated: true,
      bikeReconnectState: 'idle',
      hrReconnectState: 'idle',
      bikeAutoReconnectSuppressed: false,
      hrAutoReconnectSuppressed: false,
    });
  });

  it('exposes the latest Apple Watch sample timestamp from the store', async () => {
    await act(() => {
      useDeviceConnectionStore.getState().updateAppleWatchHr(148);
    });
    const sampledAt = useDeviceConnectionStore.getState().lastAppleWatchSampleAtMs;

    const { result } = await renderHook(() => useDeviceConnection());

    expect(result.current.lastAppleWatchSampleAtMs).toBe(sampledAt);
  });

  it('should disconnect the previous bike before reconnecting', async () => {
    const firstBikeSubscription = { remove: jest.fn() };
    const secondBikeSubscription = { remove: jest.fn() };

    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValueOnce(firstBikeSubscription).mockReturnValueOnce(secondBikeSubscription);

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
    });

    await act(async () => {
      await result.current.connectBike('bike-2');
    });

    expect(firstBikeSubscription.remove).toHaveBeenCalledTimes(1);
    expect(mockBikeDisconnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().bikeAdapter).not.toBeNull();
    expect(useDeviceConnectionStore.getState().latestBikeMetrics).toBeNull();
  });

  it('should expose bike connection progress while a connect attempt is in flight', async () => {
    let resolveConnect!: () => void;
    mockBikeConnect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });

    const { result } = await renderHook(() => useDeviceConnection());

    let connectPromise!: Promise<void>;
    await act(() => {
      connectPromise = result.current.connectBike('bike-1');
    });

    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().bikeConnectionInProgress).toBe(true);
    });

    expect(useDeviceConnectionStore.getState().bikeConnectionInProgress).toBe(true);

    await act(async () => {
      resolveConnect();
      await connectPromise;
    });

    expect(useDeviceConnectionStore.getState().bikeConnectionInProgress).toBe(false);
  });

  it('should disconnect the previous HR monitor before reconnecting', async () => {
    const firstHrSubscription = { remove: jest.fn() };
    const secondHrSubscription = { remove: jest.fn() };

    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValueOnce(firstHrSubscription).mockReturnValueOnce(secondHrSubscription);

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1');
    });

    await act(async () => {
      await result.current.connectHr('hr-2');
    });

    expect(firstHrSubscription.remove).toHaveBeenCalledTimes(1);
    expect(mockHrDisconnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().hrAdapter).not.toBeNull();
    expect(useDeviceConnectionStore.getState().latestBluetoothHr).toBeNull();
  });

  it('should remove active subscriptions and clear connection state when disconnecting all devices', async () => {
    const bikeSubscription = { remove: jest.fn() };
    const hrSubscription = { remove: jest.fn() };

    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValue(bikeSubscription);
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue(hrSubscription);
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      bikeReconnectState: 'connected',
      hrReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
      await result.current.connectHr('hr-1');
    });

    await act(() => {
      useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 32, cadence: 90, power: 210 });
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
    });

    await act(async () => {
      await result.current.disconnectAll();
    });

    expect(bikeSubscription.remove).toHaveBeenCalledTimes(1);
    expect(hrSubscription.remove).toHaveBeenCalledTimes(1);
    expect(mockBikeDisconnect).toHaveBeenCalledTimes(1);
    expect(mockHrDisconnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
    expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    expect(useDeviceConnectionStore.getState().latestBikeMetrics).toBeNull();
    expect(useDeviceConnectionStore.getState().latestBluetoothHr).toBeNull();
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(false);
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(false);
  });

  it('should mark the bike reconnect state as failed when graceful bike disconnect fails', async () => {
    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockRejectedValue(new Error('disconnect timeout'));
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      bikeReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
    });

    await act(async () => {
      await result.current.disconnectAll();
    });

    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('failed');
    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(false);
  });

  it('should keep HR reconnect state disconnected when disconnect throws an expected BLE not-connected error', async () => {
    const hrSubscription = { remove: jest.fn() };
    const expectedDisconnectError = Object.assign(new Error('Device is not connected'), { errorCode: 201 });

    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockRejectedValue(expectedDisconnectError);
    mockHrSubscribe.mockReturnValue(hrSubscription);
    useSavedGearStore.setState({
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      hrReconnectState: 'connected',
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1');
    });

    await act(async () => {
      await result.current.disconnectAll();
    });

    expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(false);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      '[useDeviceConnection] HR disconnect error:',
      expectedDisconnectError,
    );

    consoleErrorSpy.mockRestore();
  });

  it('should not log when a bike connect attempt times out', async () => {
    const timeoutError = new Error('Operation timed out');
    mockBikeConnect.mockRejectedValue(timeoutError);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1').catch(() => {});
    });

    expect(consoleErrorSpy).not.toHaveBeenCalledWith('[useDeviceConnection] Bike connection error:', timeoutError);
    consoleErrorSpy.mockRestore();
  });

  it('should not log when an HR connect attempt times out', async () => {
    const timeoutError = new Error('Operation timed out');
    mockHrConnect.mockRejectedValue(timeoutError);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1').catch(() => {});
    });

    expect(consoleErrorSpy).not.toHaveBeenCalledWith('[useDeviceConnection] HR connection error:', timeoutError);
    consoleErrorSpy.mockRestore();
  });

  it('should log when a bike connect attempt fails with an unexpected error', async () => {
    const unexpectedError = new Error('Unexpected hardware failure');
    mockBikeConnect.mockRejectedValue(unexpectedError);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1').catch(() => {});
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[useDeviceConnection] Bike connection error:', unexpectedError);
    consoleErrorSpy.mockRestore();
  });

  it('should leave reconnect state idle when intentionally disconnecting without saved gear', async () => {
    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.disconnectAll();
    });

    expect(useSavedGearStore.getState().bikeReconnectState).toBe('idle');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('idle');
  });

  it('should suppress auto-reconnect after a manual disconnect request', async () => {
    const bikeSubscription = { remove: jest.fn() };
    const hrSubscription = { remove: jest.fn() };

    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValue(bikeSubscription);
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue(hrSubscription);
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      bikeReconnectState: 'connected',
      hrReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
      await result.current.connectHr('hr-1');
      await result.current.disconnectAll({ suppressAutoReconnect: true });
    });

    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(true);
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(true);
  });

  it('rejects a second bike connect while one is already in flight', async () => {
    let resolveFirstConnect!: () => void;
    mockBikeConnect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstConnect = resolve;
        }),
    );
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });

    const { result } = await renderHook(() => useDeviceConnection());

    let firstAttempt!: Promise<void>;
    await act(() => {
      firstAttempt = result.current.connectBike('bike-1');
    });
    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().bikeConnectionInProgress).toBe(true);
    });

    await act(async () => {
      await expect(result.current.connectBike('bike-2')).rejects.toBeInstanceOf(ConnectInProgressError);
    });

    await act(async () => {
      resolveFirstConnect();
      await firstAttempt;
    });

    expect(mockBikeConnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().bikeConnectionInProgress).toBe(false);
  });

  it('rejects a second HR connect while one is already in flight', async () => {
    let resolveFirstConnect!: () => void;
    mockHrConnect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstConnect = resolve;
        }),
    );
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });

    const { result } = await renderHook(() => useDeviceConnection());

    let firstAttempt!: Promise<void>;
    await act(() => {
      firstAttempt = result.current.connectHr('hr-1');
    });
    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().hrConnectionInProgress).toBe(true);
    });

    await act(async () => {
      await expect(result.current.connectHr('hr-2')).rejects.toBeInstanceOf(ConnectInProgressError);
    });

    await act(async () => {
      resolveFirstConnect();
      await firstAttempt;
    });

    expect(mockHrConnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().hrConnectionInProgress).toBe(false);
  });

  // ── Native BLE disconnection (audit A05) ─────────────────────────────
  // The strap or bike dropping off the air is only visible through
  // `bleManager.onDeviceDisconnected`. Without it the adapter stays non-null,
  // idle readiness keeps claiming "Ready" and every reconnect path bails out
  // because it takes a live adapter as proof of a live connection.

  it('releases the HR transport and opens a reconnect cycle when the strap drops off the air', async () => {
    const hrSubscription = { remove: jest.fn() };
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue(hrSubscription);
    useSavedGearStore.setState({
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      hrReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1');
    });
    await act(() => {
      useDeviceConnectionStore.getState().updateBluetoothHr(142);
    });

    expect(
      hrSourceIdleReadiness({
        source: 'bluetooth',
        watchAvailability: 'unavailable',
        hrConnected: useDeviceConnectionStore.getState().hrAdapter !== null,
      }),
    ).toBe('ready');

    await act(() => {
      emitNativeDisconnect('hr-1');
    });

    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    });
    expect(useDeviceConnectionStore.getState().latestBluetoothHr).toBeNull();
    expect(useDeviceConnectionStore.getState().lastBluetoothHrSampleAtMs).toBeNull();
    expect(hrSubscription.remove).toHaveBeenCalledTimes(1);
    // The observer goes with the connection it was watching: leaving it armed
    // leaks a native subscription for a device the app no longer holds.
    expect(observersFor('hr-1').at(-1)?.remove).toHaveBeenCalledTimes(1);
    // And the dropped strap's connection is actually handed back to the stack.
    expect(mockHrDisconnect).toHaveBeenCalledTimes(1);
    expect(
      hrSourceIdleReadiness({
        source: 'bluetooth',
        watchAvailability: 'unavailable',
        hrConnected: useDeviceConnectionStore.getState().hrAdapter !== null,
      }),
    ).toBe('unavailable');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(false);
  });

  it('keeps the per-session HR lock when the strap drops off the air mid-ride', async () => {
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1');
    });
    await act(() => {
      useDeviceConnectionStore.getState().setActiveHrSource('bluetooth');
    });

    await act(() => {
      emitNativeDisconnect('hr-1');
    });

    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    });
    // The transport is gone, the ride's locked source is not: the dashboard must
    // keep reporting the locked strap rather than falling back to idle readiness.
    expect(useDeviceConnectionStore.getState().activeHrSource).toBe('bluetooth');

    // Nor may the reconnect probe drop the lock on its way to restoring it.
    await act(async () => {
      await result.current.connectHr('hr-1');
    });

    expect(useDeviceConnectionStore.getState().activeHrSource).toBe('bluetooth');
    expect(useDeviceConnectionStore.getState().hrAdapter).not.toBeNull();
  });

  it('releases the per-session HR lock when the user disconnects deliberately', async () => {
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1');
    });
    await act(() => {
      useDeviceConnectionStore.getState().setActiveHrSource('bluetooth');
    });

    await act(async () => {
      await result.current.disconnectHr();
    });

    expect(useDeviceConnectionStore.getState().activeHrSource).toBeNull();
  });

  it('ignores a late native disconnect from a replaced HR adapter', async () => {
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });
    useSavedGearStore.setState({
      savedHrSource: { id: 'hr-2', name: 'Polar H10', type: 'hr' },
      hrReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1');
    });
    await act(async () => {
      await result.current.connectHr('hr-2');
    });

    const replacementAdapter = useDeviceConnectionStore.getState().hrAdapter;

    await act(() => {
      emitLateNativeDisconnect('hr-1');
    });

    expect(useDeviceConnectionStore.getState().hrAdapter).toBe(replacementAdapter);
    expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
  });

  it('ignores a late native disconnect from a replaced bike adapter', async () => {
    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });
    useSavedGearStore.setState({
      savedBike: { id: 'bike-2', name: 'Zipro Rave', type: 'bike' },
      bikeReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
    });
    await act(async () => {
      await result.current.connectBike('bike-2');
    });

    const replacementAdapter = useDeviceConnectionStore.getState().bikeAdapter;

    await act(() => {
      emitLateNativeDisconnect('bike-1');
    });

    expect(useDeviceConnectionStore.getState().bikeAdapter).toBe(replacementAdapter);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
  });

  it('releases the bike connection when the bike drops off the air outside an active ride', async () => {
    const bikeSubscription = { remove: jest.fn() };
    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValue(bikeSubscription);
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      bikeReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
    });

    await act(() => {
      emitNativeDisconnect('bike-1');
    });

    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
    });
    expect(bikeSubscription.remove).toHaveBeenCalledTimes(1);
    // Same as the HR side: the observer is released with the connection.
    expect(observersFor('bike-1').at(-1)?.remove).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().latestBikeMetrics).toBeNull();
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(false);
  });

  it('disposes the native disconnect observers on a deliberate disconnect and keeps suppression', async () => {
    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      bikeReconnectState: 'connected',
      hrReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
      await result.current.connectHr('hr-1');
      await result.current.disconnectAll({ suppressAutoReconnect: true });
    });

    expect(observersFor('bike-1').at(-1)?.remove).toHaveBeenCalledTimes(1);
    expect(observersFor('hr-1').at(-1)?.remove).toHaveBeenCalledTimes(1);

    // A disconnection event that raced the deliberate teardown must not lift the
    // suppression the teardown just applied.
    await act(() => {
      emitLateNativeDisconnect('hr-1');
      emitLateNativeDisconnect('bike-1');
    });

    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(true);
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(true);
  });

  it('does not report its own cancellation as a drop when a single role is disconnected', async () => {
    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });
    mockHrConnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });
    // `cancelDeviceConnection` raises the very same native event the observer
    // watches, which is the whole reason a deliberate teardown disposes it first.
    mockBikeDisconnect.mockImplementation(async () => {
      emitNativeDisconnect('bike-1');
    });
    mockHrDisconnect.mockImplementation(async () => {
      emitNativeDisconnect('hr-1');
    });
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
      await result.current.connectHr('hr-1');
    });

    // Connecting clears suppression, so the state under test is set afterwards:
    // a caller that already decided not to reconnect must keep that decision.
    await act(() => {
      useSavedGearStore.setState({
        bikeReconnectState: 'connected',
        hrReconnectState: 'connected',
        bikeAutoReconnectSuppressed: true,
        hrAutoReconnectSuppressed: true,
      });
    });

    await act(async () => {
      await result.current.disconnectBike();
      await result.current.disconnectHr();
    });

    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(true);
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(true);
    // A bare disconnect leaves the reconnect state to its caller; only a real
    // unexpected drop rewrites it.
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
  });

  it('disarms both native disconnect observers before either role is torn down', async () => {
    let releaseBikeDisconnect!: () => void;
    const bikeDisconnectGate = new Promise<void>((resolve) => {
      releaseBikeDisconnect = resolve;
    });
    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockReturnValue(bikeDisconnectGate);
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      bikeReconnectState: 'connected',
      hrReconnectState: 'connected',
    });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
      await result.current.connectHr('hr-1');
    });

    let teardown!: Promise<void>;
    await act(() => {
      teardown = result.current.disconnectAll({ suppressAutoReconnect: true });
    });

    // The bike half is still draining its command queue, which takes seconds on
    // real hardware. The HR observer must already be gone: releasing it only
    // inside the HR half would leave the strap armed for that whole window, and
    // a drop there would lift the suppression the teardown just applied.
    expect(observersFor('hr-1').at(-1)?.removed).toBe(true);

    await act(async () => {
      emitNativeDisconnect('hr-1');
      releaseBikeDisconnect();
      await teardown;
    });

    expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(true);
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(true);
  });

  it('registers a fresh native disconnect observer for each reconnect', async () => {
    mockHrConnect.mockResolvedValue(undefined);
    mockHrDisconnect.mockResolvedValue(undefined);
    mockHrSubscribe.mockReturnValue({ remove: jest.fn() });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectHr('hr-1');
    });
    await act(() => {
      emitNativeDisconnect('hr-1');
    });
    await act(async () => {
      await result.current.connectHr('hr-1');
    });

    expect(observersFor('hr-1')).toHaveLength(2);

    await act(() => {
      emitNativeDisconnect('hr-1');
    });

    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    });
  });

  it('allows a new bike connect after a failed attempt resets the in-progress flag', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockBikeConnect.mockRejectedValueOnce(new Error('boom'));
    mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });

    const { result } = await renderHook(() => useDeviceConnection());

    await act(async () => {
      await expect(result.current.connectBike('bike-1')).rejects.toThrow('boom');
    });
    expect(useDeviceConnectionStore.getState().bikeConnectionInProgress).toBe(false);

    mockBikeConnect.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.connectBike('bike-1');
    });

    expect(mockBikeConnect).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
