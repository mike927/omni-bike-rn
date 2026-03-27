import { renderHook, act } from '@testing-library/react-native';

import { useAutoReconnect } from '../useAutoReconnect';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

jest.mock('../../../../services/gear/gearStorage');
jest.mock('../../../../features/training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => ({
    connectBike: mockConnectBike,
    connectHr: mockConnectHr,
    disconnectAll: jest.fn(),
    bikeConnected: false,
    hrConnected: false,
    latestBikeMetrics: null,
    latestHr: null,
  }),
}));

const mockConnectBike = jest.fn();
const mockConnectHr = jest.fn();

const bike = { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' as const };
const hr = { id: 'hr-uuid', name: 'Garmin HRM', type: 'hr' as const };

beforeEach(() => {
  jest.clearAllMocks();
  useDeviceConnectionStore.setState({ bikeAdapter: null, hrAdapter: null, latestBikeMetrics: null, latestHr: null });
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: null,
    hydrated: false,
    bikeReconnectState: 'idle',
    hrReconnectState: 'idle',
  });
  mockConnectBike.mockResolvedValue(undefined);
  mockConnectHr.mockResolvedValue(undefined);
});

describe('auto-reconnect on mount', () => {
  it('reconnects bike when hydrated and saved bike exists with no active adapter', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    expect(result.current.bikeReconnectState).toBe('connecting');

    await act(async () => {});

    expect(mockConnectBike).toHaveBeenCalledWith('bike-uuid');
    expect(result.current.bikeReconnectState).toBe('connected');
  });

  it('reconnects HR when hydrated and saved HR source exists', async () => {
    useSavedGearStore.setState({ savedHrSource: hr, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    expect(result.current.hrReconnectState).toBe('connecting');

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
});

describe('failed state', () => {
  it('sets bikeReconnectState to failed on connection error', async () => {
    mockConnectBike.mockRejectedValue(new Error('BLE error'));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());

    await act(async () => {});

    expect(result.current.bikeReconnectState).toBe('failed');
  });

  it('marks bike as disconnected when the adapter disappears after a successful reconnect', async () => {
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
  it('retryBike resets state to idle, triggering reconnect again', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const { result } = renderHook(() => useAutoReconnect());
    await act(async () => {});

    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retryBike();
    });

    await act(async () => {});

    expect(mockConnectBike).toHaveBeenCalledTimes(2);
  });
});

describe('no double-attempt', () => {
  it('does not start a second reconnect if one is already in progress', () => {
    mockConnectBike.mockImplementation(() => new Promise(() => {}));
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    renderHook(() => useAutoReconnect());
    renderHook(() => useAutoReconnect());

    expect(mockConnectBike).toHaveBeenCalledTimes(1);
  });
});
