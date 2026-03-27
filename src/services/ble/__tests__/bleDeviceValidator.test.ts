import { bleManager } from '../bleClient';
import { validateBikeDevice, validateHrDevice } from '../bleDeviceValidator';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockConnectToDevice.mockResolvedValue(mockDevice);
  mockDiscoverAllServicesAndCharacteristics.mockResolvedValue(mockDevice);
  mockCancelDeviceConnection.mockResolvedValue(undefined);
  mockCancel.mockResolvedValue(undefined);
});

const FTMS_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_CHAR = '00002ad2-0000-1000-8000-00805f9b34fb';
const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_CHAR = '00002a37-0000-1000-8000-00805f9b34fb';

describe('validateBikeDevice', () => {
  it('returns valid when FTMS service and indoor bike characteristic are present', async () => {
    mockServices.mockResolvedValue([{ uuid: FTMS_SERVICE }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: INDOOR_BIKE_CHAR }]);

    const result = await validateBikeDevice('device-1');

    expect(result).toEqual({ valid: true });
    expect(mockCancel).toHaveBeenCalledWith('device-1');
  });

  it('returns missing_ftms_service when FTMS service is absent', async () => {
    mockServices.mockResolvedValue([{ uuid: '0000180d-0000-1000-8000-00805f9b34fb' }]);

    const result = await validateBikeDevice('device-1');

    expect(result).toEqual({ valid: false, reason: 'missing_ftms_service' });
    expect(mockCancel).toHaveBeenCalledWith('device-1');
  });

  it('returns missing_indoor_bike_characteristic when FTMS present but char missing', async () => {
    mockServices.mockResolvedValue([{ uuid: FTMS_SERVICE }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: '00002ada-0000-1000-8000-00805f9b34fb' }]);

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
    mockServices.mockResolvedValue([{ uuid: HR_SERVICE }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: HR_CHAR }]);

    const result = await validateHrDevice('device-2');

    expect(result).toEqual({ valid: true });
    expect(mockCancel).toHaveBeenCalledWith('device-2');
  });

  it('returns missing_hr_service when HR service is absent', async () => {
    mockServices.mockResolvedValue([{ uuid: FTMS_SERVICE }]);

    const result = await validateHrDevice('device-2');

    expect(result).toEqual({ valid: false, reason: 'missing_hr_service' });
    expect(mockCancel).toHaveBeenCalledWith('device-2');
  });

  it('returns missing_hr_characteristic when HR service present but char missing', async () => {
    mockServices.mockResolvedValue([{ uuid: HR_SERVICE }]);
    mockCharacteristicsForService.mockResolvedValue([{ uuid: '00002a38-0000-1000-8000-00805f9b34fb' }]);

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
