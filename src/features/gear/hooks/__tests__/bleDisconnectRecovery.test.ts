import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAutoReconnect } from '../useAutoReconnect';
import { disconnectAllDeviceConnections } from '../../../training/hooks/useDeviceConnection';
import { bleManager } from '../../../../services/ble/bleClient';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

/**
 * End-to-end cover for audit A05: a strap that drops off the air must release
 * the connection it left behind and get exactly one reconnect cycle.
 *
 * Deliberately wires the real `useDeviceConnection` to the real
 * `useAutoReconnect`: the defect only shows up at the seam between them, where
 * reconnect policy reads a live adapter as proof of a live connection.
 */

const HR_DEVICE_ID = 'hr-1';
const BIKE_DEVICE_ID = 'bike-1';

const mockHrConnect = jest.fn();
const mockHrDisconnect = jest.fn();
const mockHrSubscribe = jest.fn();
const mockBikeConnect = jest.fn();
const mockBikeDisconnect = jest.fn();
const mockBikeSubscribe = jest.fn();

jest.mock('../../../../services/gear/gearStorage');

jest.mock('../../../../services/ble/bleClient', () => ({
  bleManager: { onDeviceDisconnected: jest.fn() },
}));

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

const mockOnDeviceDisconnected = jest.mocked(bleManager.onDeviceDisconnected);

/**
 * Registered observers, keyed by device so bike and strap never share a queue,
 * and honouring `remove()` the way a real ble-plx subscription does.
 */
interface RegisteredDisconnectObserver {
  readonly deviceId: string;
  removed: boolean;
  readonly invoke: () => void;
}

const disconnectObservers: RegisteredDisconnectObserver[] = [];
const appStateListeners: ((next: AppStateStatus) => void)[] = [];

/** Inert once the app has released the observer, exactly like the native layer. */
function emitNativeDisconnect(deviceId: string): void {
  const observer = disconnectObservers.findLast((candidate) => candidate.deviceId === deviceId);
  if (!observer) {
    throw new Error(`No native disconnect observer registered for ${deviceId}`);
  }
  if (observer.removed) {
    return;
  }
  observer.invoke();
}

function emitAppStateChange(next: AppStateStatus): void {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: next });
  for (const listener of [...appStateListeners]) {
    listener(next);
  }
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.useRealTimers();
  disconnectObservers.length = 0;
  appStateListeners.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((eventType, listener) => {
    if (eventType !== 'change') {
      return { remove: () => {} } as never;
    }
    const typedListener = listener as (next: AppStateStatus) => void;
    appStateListeners.push(typedListener);
    return {
      remove: () => {
        const index = appStateListeners.indexOf(typedListener);
        if (index >= 0) {
          appStateListeners.splice(index, 1);
        }
      },
    };
  });
  emitAppStateChange('active');
  mockOnDeviceDisconnected.mockImplementation((deviceId, listener) => {
    const observer: RegisteredDisconnectObserver = {
      deviceId,
      removed: false,
      invoke: () => listener(null, null),
    };
    disconnectObservers.push(observer);
    return {
      remove: () => {
        observer.removed = true;
      },
    };
  });
  mockHrConnect.mockResolvedValue(undefined);
  mockHrDisconnect.mockResolvedValue(undefined);
  mockHrSubscribe.mockReturnValue({ remove: jest.fn() });
  mockBikeConnect.mockResolvedValue(undefined);
  mockBikeDisconnect.mockResolvedValue(undefined);
  mockBikeSubscribe.mockReturnValue({ remove: jest.fn() });
  useDeviceConnectionStore.getState().clearAll();
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: { id: HR_DEVICE_ID, name: 'Garmin HRM', type: 'hr' },
    hydrated: true,
    bikeReconnectState: 'idle',
    hrReconnectState: 'idle',
    bikeAutoReconnectSuppressed: false,
    hrAutoReconnectSuppressed: false,
  });
});

describe('BLE disconnection recovery', () => {
  it('runs exactly one reconnect cycle after the strap drops off the air', async () => {
    await renderHook(() => useAutoReconnect());

    await waitFor(() => {
      expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
    });
    expect(mockHrConnect).toHaveBeenCalledTimes(1);

    await act(() => {
      emitNativeDisconnect(HR_DEVICE_ID);
    });

    await waitFor(() => {
      expect(mockHrConnect).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
    });
    expect(useDeviceConnectionStore.getState().hrAdapter).not.toBeNull();

    // One cycle, not a storm: a recovered connection must not keep probing.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(mockHrConnect).toHaveBeenCalledTimes(2);
  });

  it('lets an explicit Retry dial again after the strap dropped off the air', async () => {
    const { result } = await renderHook(() => useAutoReconnect());

    await waitFor(() => {
      expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
    });
    expect(mockHrConnect).toHaveBeenCalledTimes(1);

    // Background the app so the automatic cycle stands down and Retry is the
    // only thing that can dial: the audit's second symptom was Retry reading the
    // stale adapter as a live connection and reporting success without dialling.
    await act(() => {
      emitAppStateChange('background');
    });
    await act(() => {
      emitNativeDisconnect(HR_DEVICE_ID);
    });

    await waitFor(() => {
      expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    });
    expect(mockHrConnect).toHaveBeenCalledTimes(1);

    await act(() => {
      result.current.retryHr();
    });

    await waitFor(() => {
      expect(mockHrConnect).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
    });
    expect(useDeviceConnectionStore.getState().hrAdapter).not.toBeNull();
  });

  it('reconnects only the role that dropped when both devices are connected', async () => {
    useSavedGearStore.setState({ savedBike: { id: BIKE_DEVICE_ID, name: 'Zipro Rave', type: 'bike' } });

    await renderHook(() => useAutoReconnect());

    await waitFor(() => {
      expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
    });
    await waitFor(() => {
      expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
    });
    expect(mockBikeConnect).toHaveBeenCalledTimes(1);
    expect(mockHrConnect).toHaveBeenCalledTimes(1);

    const hrAdapterBeforeDrop = useDeviceConnectionStore.getState().hrAdapter;

    await act(() => {
      emitNativeDisconnect(BIKE_DEVICE_ID);
    });

    await waitFor(() => {
      expect(mockBikeConnect).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
    });

    // Each role has its own observer and its own store fields, so the strap
    // never noticed and nothing dialled it.
    expect(useDeviceConnectionStore.getState().hrAdapter).toBe(hrAdapterBeforeDrop);
    expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
    expect(mockHrConnect).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect the strap when it drops while the ride-end teardown is still running', async () => {
    useSavedGearStore.setState({ savedBike: { id: BIKE_DEVICE_ID, name: 'Zipro Rave', type: 'bike' } });

    await renderHook(() => useAutoReconnect());

    await waitFor(() => {
      expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
    });
    await waitFor(() => {
      expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
    });
    expect(mockHrConnect).toHaveBeenCalledTimes(1);

    // End the ride. The bike half drains its command queue first, which on real
    // hardware is bounded by CONTROL_COMMAND_DRAIN_TIMEOUT_MS, so the strap has
    // seconds in which to go out of range while the teardown is still running.
    let releaseBikeDisconnect!: () => void;
    mockBikeDisconnect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseBikeDisconnect = resolve;
      }),
    );
    // A reconnect probe that does dial outlives the teardown, so its adapter is
    // stored after the teardown has already given up on the strap.
    let releaseHrProbe: (() => void) | undefined;
    mockHrConnect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseHrProbe = resolve;
        }),
    );

    let teardown!: Promise<void>;
    await act(() => {
      teardown = disconnectAllDeviceConnections({ updateReconnectState: true, suppressAutoReconnect: true });
    });

    await act(() => {
      emitNativeDisconnect(HR_DEVICE_ID);
    });
    // Give the reconnect cycle its immediate probe while the bike is still draining.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await act(async () => {
      releaseBikeDisconnect();
      await teardown;
    });
    await act(async () => {
      releaseHrProbe?.();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The ride is over: no strap connection survives it and no probe was dialled.
    expect(mockHrConnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    expect(useSavedGearStore.getState().hrAutoReconnectSuppressed).toBe(true);
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');
  });
});
