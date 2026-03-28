import { renderHook, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAutoReconnect } from '../useAutoReconnect';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

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
    latestHr: null,
  }),
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
  useDeviceConnectionStore.setState({ bikeAdapter: null, hrAdapter: null, latestBikeMetrics: null, latestHr: null });
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

describe('auto-reconnect on mount', () => {
  it('reconnects bike when hydrated and saved bike exists with no active adapter', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    expect(['connecting', 'connected']).toContain(result.current.bikeReconnectState);

    await act(async () => {});

    expect(mockConnectBike).toHaveBeenCalledWith('bike-uuid');
    expect(result.current.bikeReconnectState).toBe('connected');
  });

  it('reconnects HR when hydrated and saved HR source exists', async () => {
    useSavedGearStore.setState({ savedHrSource: hr, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    expect(['connecting', 'connected']).toContain(result.current.hrReconnectState);

    await act(async () => {});

    expect(mockConnectHr).toHaveBeenCalledWith('hr-uuid');
    expect(result.current.hrReconnectState).toBe('connected');
  });

  it('does not reconnect if not yet hydrated', () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: false });

    renderHook(() => useAutoReconnect());

    expect(mockConnectBike).not.toHaveBeenCalled();
  });

  it('does not reconnect if adapter already active', () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });
    useDeviceConnectionStore.setState({ bikeAdapter: {} as never });

    renderHook(() => useAutoReconnect());

    expect(mockConnectBike).not.toHaveBeenCalled();
  });

  it('does not reconnect automatically when bike auto-reconnect is suppressed', () => {
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'disconnected',
      bikeAutoReconnectSuppressed: true,
    });

    renderHook(() => useAutoReconnect());

    expect(mockConnectBike).not.toHaveBeenCalled();
  });
});

describe('failed state', () => {
  it('sets bikeReconnectState to failed on connection error', async () => {
    mockConnectBike.mockRejectedValue(new Error('BLE error'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    await act(async () => {});

    expect(result.current.bikeReconnectState).toBe('failed');
  });

  it('treats cancelled reconnect attempts as disconnected without logging an error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cancelledError = Object.assign(new Error('Operation was cancelled'), { errorCode: 2 });

    mockConnectBike.mockRejectedValue(cancelledError);
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    await act(async () => {});

    expect(result.current.bikeReconnectState).toBe('disconnected');
    expect(consoleErrorSpy).not.toHaveBeenCalledWith('[useAutoReconnect] Bike connect failed:', cancelledError);

    consoleErrorSpy.mockRestore();
  });

  it('treats connection timeouts as disconnected without logging an error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const timeoutError = new Error('Operation timed out');

    mockConnectBike.mockRejectedValue(timeoutError);
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    await act(async () => {});

    expect(result.current.bikeReconnectState).toBe('disconnected');
    expect(consoleErrorSpy).not.toHaveBeenCalledWith('[useAutoReconnect] Bike connect failed:', timeoutError);

    consoleErrorSpy.mockRestore();
  });

  it('marks bike as disconnected when the adapter disappears after a successful connect', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true, bikeReconnectState: 'connected' });
    useDeviceConnectionStore.setState({ bikeAdapter: {} as never });

    const { result } = renderHook(() => useAutoReconnect());

    act(() => {
      useDeviceConnectionStore.setState({ bikeAdapter: null });
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
    useSavedGearStore.setState({ savedBike: bike, hydrated: true, bikeReconnectState: 'failed' });

    const { result } = renderHook(() => useAutoReconnect());

    act(() => {
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

    const { result } = renderHook(() => useAutoReconnect());

    act(() => {
      result.current.retryBike();
    });

    await act(async () => {});

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
    useSavedGearStore.setState({ savedBike: bike, hydrated: true, bikeReconnectState: 'failed' });

    const { result } = renderHook(() => useAutoReconnect());

    act(() => {
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
    useSavedGearStore.setState({ savedBike: bike, hydrated: true, bikeReconnectState: 'failed' });

    const { result } = renderHook(() => useAutoReconnect());

    act(() => {
      result.current.retryBike();
    });

    act(() => {
      useSavedGearStore.setState({ savedBike: null, bikeReconnectState: 'idle' });
    });

    await act(async () => {
      resolveConnect();
    });

    expect(mockDisconnectBike).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('idle');
    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
  });

  it('retries disconnected bikes automatically with backoff while the app is active', async () => {
    jest.useFakeTimers();
    mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    renderHook(() => useAutoReconnect());

    await act(async () => {});

    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(4999);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(2);

    await act(async () => {});

    await act(async () => {
      jest.advanceTimersByTime(9999);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(3);
  });

  it('does not auto-retry while the app is backgrounded and resumes when active again', async () => {
    jest.useFakeTimers();
    mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    renderHook(() => useAutoReconnect());

    await act(async () => {});

    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    act(() => {
      emitAppStateChange('background');
    });

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    act(() => {
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

    const { result } = renderHook(() => useAutoReconnect());

    await act(async () => {});

    expect(result.current.bikeReconnectState).toBe('connected');
  });
});
