import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDeviceConnection } from '../useDeviceConnection';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

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

  it('should disconnect the previous bike before reconnecting', async () => {
    const firstBikeSubscription = { remove: jest.fn() };
    const secondBikeSubscription = { remove: jest.fn() };

    mockBikeConnect.mockResolvedValue(undefined);
    mockBikeDisconnect.mockResolvedValue(undefined);
    mockBikeSubscribe.mockReturnValueOnce(firstBikeSubscription).mockReturnValueOnce(secondBikeSubscription);

    const { result } = renderHook(() => useDeviceConnection());

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

    const { result } = renderHook(() => useDeviceConnection());

    let connectPromise!: Promise<void>;
    act(() => {
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

    const { result } = renderHook(() => useDeviceConnection());

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

    const { result } = renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1');
      await result.current.connectHr('hr-1');
    });

    act(() => {
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

    const { result } = renderHook(() => useDeviceConnection());

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
    const { result } = renderHook(() => useDeviceConnection());

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
    const { result } = renderHook(() => useDeviceConnection());

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
    const { result } = renderHook(() => useDeviceConnection());

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
    const { result } = renderHook(() => useDeviceConnection());

    await act(async () => {
      await result.current.connectBike('bike-1').catch(() => {});
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[useDeviceConnection] Bike connection error:', unexpectedError);
    consoleErrorSpy.mockRestore();
  });

  it('should leave reconnect state idle when intentionally disconnecting without saved gear', async () => {
    const { result } = renderHook(() => useDeviceConnection());

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

    const { result } = renderHook(() => useDeviceConnection());

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
});
