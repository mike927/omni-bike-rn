import { bleManager } from '../bleClient';
import { validateBikeDevice, validateHrDevice } from '../bleDeviceValidator';
import {
  FTMS_INDOOR_BIKE_DATA_UUID,
  FTMS_MACHINE_STATUS_UUID,
  FTMS_SERVICE_UUID,
  HR_MEASUREMENT_CHARACTERISTIC_UUID,
  HR_SERVICE_UUID,
} from '../bleUuids';

const mockServices = jest.fn();
const mockCharacteristicsForService = jest.fn();
const mockDiscoverAllServicesAndCharacteristics = jest.fn();
const mockCancelDeviceConnection = jest.fn();

const mockDevice = {
  discoverAllServicesAndCharacteristics: mockDiscoverAllServicesAndCharacteristics,
  services: mockServices,
  characteristicsForService: mockCharacteristicsForService,
};

const mockConnectToDevice = bleManager.connectToDevice as jest.Mock;
const mockCancel = bleManager.cancelDeviceConnection as jest.Mock;
const OTHER_HR_CHARACTERISTIC_UUID = '00002a38-0000-1000-8000-00805f9b34fb';

beforeEach(() => {
  jest.clearAllMocks();
  mockConnectToDevice.mockResolvedValue(mockDevice);
  mockDiscoverAllServicesAndCharacteristics.mockResolvedValue(mockDevice);
  mockCancelDeviceConnection.mockResolvedValue(undefined);
  mockCancel.mockResolvedValue(undefined);
});

describe('validateBikeDevice', () => {
  it('returns valid when FTMS service and indoor bike characteristic are present', async () => {
    mockServices.mockResolvedValue([{ uuid: FTMS_SERVICE_UUID }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: FTMS_INDOOR_BIKE_DATA_UUID }]);

    const result = await validateBikeDevice('device-1');

    expect(result).toEqual({ valid: true });
    // Connection stays alive for the adapter to reuse
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('returns missing_ftms_service when FTMS service is absent', async () => {
    mockServices.mockResolvedValue([{ uuid: HR_SERVICE_UUID }]);

    const result = await validateBikeDevice('device-1');

    expect(result).toEqual({ valid: false, reason: 'missing_ftms_service' });
    expect(mockCancel).toHaveBeenCalledWith('device-1');
  });

  it('returns missing_indoor_bike_characteristic when FTMS present but char missing', async () => {
    mockServices.mockResolvedValue([{ uuid: FTMS_SERVICE_UUID }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: FTMS_MACHINE_STATUS_UUID }]);

    const result = await validateBikeDevice('device-1');

    expect(result).toEqual({ valid: false, reason: 'missing_indoor_bike_characteristic' });
    expect(mockCancel).toHaveBeenCalledWith('device-1');
  });

  it('disconnects after validation even on error', async () => {
    mockConnectToDevice.mockRejectedValue(new Error('connection failed'));

    const result = await validateBikeDevice('device-1');

    expect(result.valid).toBe(false);
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe('validateHrDevice', () => {
  it('returns valid when HR service and measurement characteristic are present', async () => {
    mockServices.mockResolvedValue([{ uuid: HR_SERVICE_UUID }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: HR_MEASUREMENT_CHARACTERISTIC_UUID }]);

    const result = await validateHrDevice('device-2');

    expect(result).toEqual({ valid: true });
    // Connection stays alive for the adapter to reuse
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('returns missing_hr_service when HR service is absent', async () => {
    mockServices.mockResolvedValue([{ uuid: FTMS_SERVICE_UUID }]);

    const result = await validateHrDevice('device-2');

    expect(result).toEqual({ valid: false, reason: 'missing_hr_service' });
    expect(mockCancel).toHaveBeenCalledWith('device-2');
  });

  it('returns missing_hr_characteristic when HR service present but char missing', async () => {
    mockServices.mockResolvedValue([{ uuid: HR_SERVICE_UUID }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: OTHER_HR_CHARACTERISTIC_UUID }]);

    const result = await validateHrDevice('device-2');

    expect(result).toEqual({ valid: false, reason: 'missing_hr_characteristic' });
    expect(mockCancel).toHaveBeenCalledWith('device-2');
  });

  it('disconnects after validation even on error', async () => {
    mockConnectToDevice.mockRejectedValue(new Error('connection failed'));

    const result = await validateHrDevice('device-2');

    expect(result.valid).toBe(false);
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
