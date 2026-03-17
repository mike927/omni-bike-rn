import { ZiproRaveAdapter } from '../ZiproRaveAdapter';
import { bleManager } from '../bleClient';

jest.mock('../bleClient', () => ({
  bleManager: {
    connectToDevice: jest.fn(),
    cancelDeviceConnection: jest.fn(),
  },
}));

describe('ZiproRaveAdapter', () => {
  const DEVICE_ID = 'test-bike-123';
  let adapter: ZiproRaveAdapter;

  const createMockDevice = () => ({
    name: 'Test Bike',
    discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
    services: jest.fn().mockResolvedValue([{ uuid: 'service-1' }]),
    characteristicsForService: jest.fn().mockImplementation((uuid) => {
      if (uuid === 'service-1') {
        return Promise.resolve([
          {
            uuid: 'char-1',
            isReadable: true,
            isWritableWithResponse: false,
            isNotifiable: true,
          },
        ]);
      }
      return Promise.resolve([]);
    }),
    monitorCharacteristicForService: jest.fn().mockImplementation((_serviceId, _charId, _callback) => {
      // Return a dummy subscription
      return { remove: jest.fn() };
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ZiproRaveAdapter(DEVICE_ID);
  });

  describe('connect', () => {
    it('should connect to the device and discover services', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();

      expect(bleManager.connectToDevice).toHaveBeenCalledWith(DEVICE_ID);
      expect(mockDevice.discoverAllServicesAndCharacteristics).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should cancel device connection if connected', async () => {
      const mockDevice = createMockDevice();
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

  describe('subscribeToMetrics', () => {
    it('should throw an error if not connected', () => {
      expect(() => {
        adapter.subscribeToMetrics(jest.fn());
      }).toThrow('Device not connected');
    });

    it('should return a subscription object', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      const sub = adapter.subscribeToMetrics(jest.fn());

      expect(sub).toBeDefined();
      expect(typeof sub.remove).toBe('function');
    });

    it('should decode base64 metric payloads into BikeMetrics', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();

      const callback = jest.fn();
      adapter.subscribeToMetrics(callback);

      // Extract the callback that the adapter passed to monitorCharacteristicForService
      const monitorCallback = mockDevice.monitorCharacteristicForService.mock.calls[0][2];

      // Simulate FTMS Indoor Bike Data payload:
      // Flags (16-bit) -> 0x0074 (Binary: 0000 0000 0111 0100) -> Speed(0), Cadence(1), Distance(1), Resistance(1), Power(1)
      // Two bytes: [0x74, 0x00]
      // Speed (15.5 km/h) -> 1550 (0x060E). Bytes: [14, 6]
      // Cadence (85 RPM) -> 170 (resol 0.5) (0x00AA). Bytes: [170, 0]
      // Distance (1200 meters) -> 1200 (0x0004B0). Bytes: [176, 4, 0]
      // Resistance (12) -> 12 (0x000C). Bytes: [12, 0]
      // Power (150 W) -> 150 (0x0096). Bytes: [150, 0]
      const mockBytes = new Uint8Array([0x74, 0x00, 14, 6, 170, 0, 176, 4, 0, 12, 0, 150, 0]);
      // Convert to base64
      let binaryString = '';
      for (let i = 0; i < mockBytes.length; i++) {
        binaryString += String.fromCharCode(mockBytes[i]!);
      }
      const base64Value = btoa(binaryString);

      const mockChar = { value: base64Value };
      monitorCallback(null, mockChar);

      expect(callback).toHaveBeenCalledWith({
        speed: 15.5,
        cadence: 85,
        power: 150,
        distance: 1200,
        resistance: 12,
        heartRate: undefined, // Not in flags
      });
    });
  });
});
