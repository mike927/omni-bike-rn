import { renderHook, act } from '@testing-library/react-native';

import { useGearSetup } from '../useGearSetup';
import * as bleDeviceValidator from '../../../../services/ble/bleDeviceValidator';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

jest.mock('../../../../services/ble/bleDeviceValidator');
jest.mock('../../../../services/gear/gearStorage');
jest.mock('../../../../features/devices/hooks/useBlePermission', () => ({
  useBlePermission: () => ({ requestBlePermission: jest.fn().mockResolvedValue('granted') }),
}));
jest.mock('../../../../features/devices/hooks/useBleScanner', () => ({
  useBleScanner: () => ({
    devices: [],
    isScanning: false,
    error: null,
    scanForDevices: jest.fn(),
    stopScanning: jest.fn(),
  }),
}));
jest.mock('../../../../features/training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => ({
    connectBike: mockConnectBike,
    connectHr: mockConnectHr,
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
