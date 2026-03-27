import { renderHook, act } from '@testing-library/react-native';

import { useGearSetup } from '../useGearSetup';
import * as bleDeviceValidator from '../../../../services/ble/bleDeviceValidator';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

jest.mock('../../../../services/ble/bleDeviceValidator');
jest.mock('../../../../services/gear/gearStorage');
const mockRequestBlePermission = jest.fn();
const mockScanForDevices = jest.fn();
const mockStopScanning = jest.fn();
jest.mock('../../../../features/devices/hooks/useBlePermission', () => ({
  useBlePermission: () => ({ requestBlePermission: mockRequestBlePermission }),
}));
jest.mock('../../../../features/devices/hooks/useBleScanner', () => ({
  useBleScanner: () => ({
    devices: [],
    isScanning: false,
    error: null,
    scanForDevices: mockScanForDevices,
    stopScanning: mockStopScanning,
  }),
}));
const mockDisconnectBike = jest.fn();
const mockDisconnectHr = jest.fn();
jest.mock('../../../../features/training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => ({
    connectBike: mockConnectBike,
    connectHr: mockConnectHr,
    disconnectBike: mockDisconnectBike,
    disconnectHr: mockDisconnectHr,
  }),
}));

const mockConnectBike = jest.fn();
const mockConnectHr = jest.fn();
const mockValidateBike = bleDeviceValidator.validateBikeDevice as jest.Mock;
const mockValidateHr = bleDeviceValidator.validateHrDevice as jest.Mock;

const bikeDevice = { id: 'bike-id', name: 'Zipro Rave' };
const hrDevice = { id: 'hr-id', name: 'Garmin HRM' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  useDeviceConnectionStore.setState({ latestBikeMetrics: null, latestHr: null });
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: null,
    hydrated: false,
    bikeReconnectState: 'idle',
    hrReconnectState: 'idle',
  });
  mockConnectBike.mockResolvedValue(undefined);
  mockConnectHr.mockResolvedValue(undefined);
  mockDisconnectBike.mockResolvedValue(undefined);
  mockDisconnectHr.mockResolvedValue(undefined);
  mockRequestBlePermission.mockResolvedValue('granted');
  mockScanForDevices.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('valid device flow (bike)', () => {
  it('transitions through validating → connecting → awaiting_signal → ready on live signal', async () => {
    mockValidateBike.mockResolvedValue({ valid: true });

    const { result } = renderHook(() => useGearSetup('bike'));

    await act(async () => {
      await result.current.selectDevice(bikeDevice as never);
    });

    expect(result.current.step).toBe('awaiting_signal');

    act(() => {
      useDeviceConnectionStore.setState({ latestBikeMetrics: { speed: 10, cadence: 80, power: 150 } });
    });

    expect(result.current.step).toBe('ready');
    expect(result.current.signalConfirmed).toBe(true);
  });
});

describe('invalid device sets error', () => {
  it('sets validationError and step to error when bike validation fails', async () => {
    mockValidateBike.mockResolvedValue({ valid: false, reason: 'missing_ftms_service' });

    const { result } = renderHook(() => useGearSetup('bike'));

    await act(async () => {
      await result.current.selectDevice(bikeDevice as never);
    });

    expect(result.current.step).toBe('error');
    expect(result.current.validationError).toBe('missing_ftms_service');
    expect(mockConnectBike).not.toHaveBeenCalled();
  });

  it('sets validationError and step to error when HR validation fails', async () => {
    mockValidateHr.mockResolvedValue({ valid: false, reason: 'missing_hr_service' });

    const { result } = renderHook(() => useGearSetup('hr'));

    await act(async () => {
      await result.current.selectDevice(hrDevice as never);
    });

    expect(result.current.step).toBe('error');
    expect(result.current.validationError).toBe('missing_hr_service');
    expect(mockConnectHr).not.toHaveBeenCalled();
  });
});

describe('scan permissions', () => {
  it('does not start scanning when Bluetooth permission is denied', async () => {
    mockRequestBlePermission.mockResolvedValue('denied');

    const { result } = renderHook(() => useGearSetup('bike'));

    let permissionResult: Awaited<ReturnType<typeof result.current.startScan>> | undefined;

    await act(async () => {
      permissionResult = await result.current.startScan();
    });

    expect(permissionResult).toBe('denied');
    expect(mockScanForDevices).not.toHaveBeenCalled();
  });
});

describe('signal timeout', () => {
  it('sets no_live_signal error after 8s with no data', async () => {
    mockValidateBike.mockResolvedValue({ valid: true });

    const { result } = renderHook(() => useGearSetup('bike'));

    await act(async () => {
      await result.current.selectDevice(bikeDevice as never);
    });

    expect(result.current.step).toBe('awaiting_signal');

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(result.current.step).toBe('error');
    expect(result.current.validationError).toBe('no_live_signal');
    await act(async () => {});
    expect(mockDisconnectBike).toHaveBeenCalledTimes(1);
  });
});

describe('connection failures', () => {
  it('uses a generic connection_failed reason for HR connection errors', async () => {
    mockValidateHr.mockResolvedValue({ valid: true });
    mockConnectHr.mockRejectedValue(new Error('BLE timeout'));

    const { result } = renderHook(() => useGearSetup('hr'));

    await act(async () => {
      await result.current.selectDevice(hrDevice as never);
    });

    expect(result.current.step).toBe('error');
    expect(result.current.validationError).toBe('connection_failed');
    expect(mockDisconnectHr).toHaveBeenCalledTimes(1);
  });
});

describe('cleanup', () => {
  it('disconnects an unsaved setup connection when the hook unmounts', async () => {
    mockValidateBike.mockResolvedValue({ valid: true });

    const { result, unmount } = renderHook(() => useGearSetup('bike'));

    await act(async () => {
      await result.current.selectDevice(bikeDevice as never);
    });

    unmount();

    await act(async () => {});

    expect(mockDisconnectBike).toHaveBeenCalledTimes(1);
  });
});

describe('save', () => {
  it('persists bike device and name to store after signal confirmed', async () => {
    mockValidateBike.mockResolvedValue({ valid: true });
    const persistBike = jest.fn().mockResolvedValue(undefined);
    useSavedGearStore.setState({ persistBike } as never);

    const { result } = renderHook(() => useGearSetup('bike'));

    await act(async () => {
      await result.current.selectDevice(bikeDevice as never);
    });

    act(() => {
      useDeviceConnectionStore.setState({ latestBikeMetrics: { speed: 10, cadence: 80, power: 150 } });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(persistBike).toHaveBeenCalledWith({ id: 'bike-id', name: 'Zipro Rave', type: 'bike' });
  });

  it('does not save when signal not confirmed', async () => {
    mockValidateBike.mockResolvedValue({ valid: true });
    const persistBike = jest.fn().mockResolvedValue(undefined);
    useSavedGearStore.setState({ persistBike } as never);

    const { result } = renderHook(() => useGearSetup('bike'));

    await act(async () => {
      await result.current.selectDevice(bikeDevice as never);
    });

    // do NOT trigger signal
    await act(async () => {
      await result.current.save();
    });

    expect(persistBike).not.toHaveBeenCalled();
  });
});
