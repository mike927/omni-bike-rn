import { StandardHrAdapter } from '../StandardHrAdapter';
import { bleManager } from '../bleClient';

jest.mock('../bleClient', () => ({
  bleManager: {
    connectToDevice: jest.fn(),
    cancelDeviceConnection: jest.fn(),
    monitorCharacteristicForDevice: jest.fn(),
  },
}));

describe('StandardHrAdapter', () => {
  const DEVICE_ID = 'test-device-123';
  let adapter: StandardHrAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new StandardHrAdapter(DEVICE_ID);
  });

  describe('connect', () => {
    it('should connect to the device and discover services', async () => {
      const mockDevice = {
        name: 'Test HR Monitor',
        discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
      };
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();

      expect(bleManager.connectToDevice).toHaveBeenCalledWith(DEVICE_ID);
      expect(mockDevice.discoverAllServicesAndCharacteristics).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should cancel device connection if connected', async () => {
      const mockDevice = {
        name: 'Test HR Monitor',
        discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
      };
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      await adapter.disconnect();

      expect(bleManager.cancelDeviceConnection).toHaveBeenCalledWith(DEVICE_ID);
    });

    it('should not cancel device connection if not connected', async () => {
      await adapter.disconnect();
      expect(bleManager.cancelDeviceConnection).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToHeartRate', () => {
    it('should throw an error if not connected', () => {
      expect(() => {
        adapter.subscribeToHeartRate(jest.fn());
      }).toThrow('Device not connected');
    });

    it('should correctly parse 8-bit uint HR data', async () => {
      const mockDevice = {
        name: 'Test HR Monitor',
        discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
      };
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      const mockCallback = jest.fn();
      const mockSubscription = { remove: jest.fn() };

      let captureListener: (error: Error | null, characteristic: { value: string } | null) => void = () => {};
      (bleManager.monitorCharacteristicForDevice as jest.Mock).mockImplementation(
        (_deviceId, _serviceUUID, _charUUID, listener) => {
          captureListener = listener;
          return mockSubscription;
        },
      );

      await adapter.connect();
      const sub = adapter.subscribeToHeartRate(mockCallback);

      expect(sub).toBe(mockSubscription);

      // Simulate receiving data: Flags point to 8-bit format (bit 0 is 0), HR is 120 (0x78)
      // Base64 encoding of [0x00, 0x78] -> 'AHg='
      captureListener(null, { value: 'AHg=' });

      expect(mockCallback).toHaveBeenCalledWith(120);
    });

    it('should correctly parse 16-bit uint HR data', async () => {
      const mockDevice = {
        name: 'Test HR Monitor',
        discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
      };
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      const mockCallback = jest.fn();

      let captureListener: (error: Error | null, characteristic: { value: string } | null) => void = () => {};
      (bleManager.monitorCharacteristicForDevice as jest.Mock).mockImplementation(
        (_deviceId, _serviceUUID, _charUUID, listener) => {
          captureListener = listener;
          return { remove: jest.fn() };
        },
      );

      await adapter.connect();
      adapter.subscribeToHeartRate(mockCallback);

      // Simulate receiving data: Flags point to 16-bit format (bit 0 is 1), HR is 300 (0x012C -> LE: 0x2C, 0x01)
      // Base64 encoding of [0x01, 0x2C, 0x01] -> 'ASwB'
      captureListener(null, { value: 'ASwB' });

      expect(mockCallback).toHaveBeenCalledWith(300);
    });
  });
});
