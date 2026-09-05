import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAutoReconnect } from '../useAutoReconnect';
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

const mockHrConnect = jest.fn();
const mockHrDisconnect = jest.fn();
const mockHrSubscribe = jest.fn();

jest.mock('../../../../services/gear/gearStorage');

jest.mock('../../../../services/ble/bleClient', () => ({
  bleManager: { onDeviceDisconnected: jest.fn() },
}));

jest.mock('../../../../services/ble/ZiproRaveAdapter', () => ({
  ZiproRaveAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeToMetrics: jest.fn().mockReturnValue({ remove: jest.fn() }),
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

const hrListeners: (() => void)[] = [];
const appStateListeners: ((next: AppStateStatus) => void)[] = [];

function emitNativeHrDisconnect(): void {
  const emit = hrListeners.at(-1);
  if (!emit) {
    throw new Error('No native disconnect observer registered for the HR strap');
  }
  emit();
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
  hrListeners.length = 0;
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
  mockOnDeviceDisconnected.mockImplementation((_deviceId, listener) => {
    hrListeners.push(() => listener(null, null));
    return { remove: jest.fn() };
  });
  mockHrConnect.mockResolvedValue(undefined);
  mockHrDisconnect.mockResolvedValue(undefined);
  mockHrSubscribe.mockReturnValue({ remove: jest.fn() });
  useDeviceConnectionStore.getState().clearAll();
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
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
      emitNativeHrDisconnect();
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
      emitNativeHrDisconnect();
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
});
