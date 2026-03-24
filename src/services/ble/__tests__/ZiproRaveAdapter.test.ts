import { BikeStatus } from '../BikeAdapter';
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
    writeCharacteristicWithResponseForService: jest.fn().mockResolvedValue(undefined),
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

      // Extract the callbacks that the adapter passed to monitorCharacteristicForService
      const dataCallback = mockDevice.monitorCharacteristicForService.mock.calls[0][2];
      const statusCallback = mockDevice.monitorCharacteristicForService.mock.calls[1][2];

      // 1. Simulate FTMS Indoor Bike Data payload:
      // Flags (16-bit) -> 0x0074 (Binary: 0000 0000 0111 0100) -> Speed(0), Cadence(1), Distance(1), Resistance(1), Power(1)
      const mockBytes = new Uint8Array([0x74, 0x00, 14, 6, 170, 0, 176, 4, 0, 12, 0, 150, 0]);
      let binaryString = '';
      for (let i = 0; i < mockBytes.length; i++) {
        binaryString += String.fromCharCode(mockBytes[i]!);
      }

      const mockDataChar = { value: btoa(binaryString) };
      dataCallback(null, mockDataChar);

      expect(callback).toHaveBeenCalledWith({
        speed: 15.5,
        cadence: 85,
        power: 150,
        distance: 1200,
        resistance: 12,
        heartRate: undefined, // Not in flags
      });

      // 2. Simulate Machine Status Event: User Paused (0x02)
      const mockStatusBytes = new Uint8Array([0x02]);
      let statusBinaryString = '';
      for (let i = 0; i < mockStatusBytes.length; i++) {
        statusBinaryString += String.fromCharCode(mockStatusBytes[i]!);
      }

      const mockStatusChar = { value: btoa(statusBinaryString) };
      statusCallback(null, mockStatusChar);

      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: BikeStatus.Stopped,
          speed: 15.5, // Should retain previous metrics state
        }),
      );
    });

    it('should ignore expected monitor cancellation errors during teardown', async () => {
      const mockDevice = createMockDevice();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      adapter.subscribeToMetrics(jest.fn());

      const dataCallback = mockDevice.monitorCharacteristicForService.mock.calls[0][2];
      const statusCallback = mockDevice.monitorCharacteristicForService.mock.calls[1][2];
      const cancelledError = Object.assign(new Error('Operation was cancelled'), { errorCode: 2 });

      dataCallback(cancelledError, null);
      statusCallback(cancelledError, null);

      expect(consoleErrorSpy).not.toHaveBeenCalledWith('[ZiproRave] FTMS Data Monitoring error:', cancelledError);
      expect(consoleErrorSpy).not.toHaveBeenCalledWith('[ZiproRave] FTMS Status Monitoring error:', cancelledError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('setControlState', () => {
    it('should request control before sending a reset command', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      await adapter.setControlState(BikeStatus.Reset);

      expect(mockDevice.writeCharacteristicWithResponseForService).toHaveBeenNthCalledWith(
        1,
        '00001826-0000-1000-8000-00805f9b34fb',
        '00002ad9-0000-1000-8000-00805f9b34fb',
        'AA==',
      );
      expect(mockDevice.writeCharacteristicWithResponseForService).toHaveBeenNthCalledWith(
        2,
        '00001826-0000-1000-8000-00805f9b34fb',
        '00002ad9-0000-1000-8000-00805f9b34fb',
        'AQ==',
      );
      expect(bleManager.cancelDeviceConnection).toHaveBeenCalledWith(DEVICE_ID);
      expect(bleManager.connectToDevice).toHaveBeenCalledTimes(2);
    });

    it('should send start directly without requesting control first', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      await adapter.setControlState(BikeStatus.Started);

      expect(mockDevice.writeCharacteristicWithResponseForService).toHaveBeenCalledTimes(1);
      expect(mockDevice.writeCharacteristicWithResponseForService).toHaveBeenCalledWith(
        '00001826-0000-1000-8000-00805f9b34fb',
        '00002ad9-0000-1000-8000-00805f9b34fb',
        'Bw==',
      );
    });

    it('should ignore expected disconnect errors while a control write is in flight', async () => {
      const disconnectError = Object.assign(new Error(`Device ${DEVICE_ID} was disconnected`), { errorCode: 201 });
      const mockDevice = createMockDevice();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDevice.writeCharacteristicWithResponseForService.mockRejectedValue(disconnectError);
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      await adapter.setControlState(BikeStatus.Stopped);

      expect(consoleErrorSpy).not.toHaveBeenCalledWith('[ZiproRave] Failed to set control state:', disconnectError);

      consoleErrorSpy.mockRestore();
    });
  });
});
