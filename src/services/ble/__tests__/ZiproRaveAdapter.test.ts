import { BikeStatus } from '../BikeAdapter';
import { ZiproRaveAdapter } from '../ZiproRaveAdapter';
import { bleManager } from '../bleClient';
import { FTMS_CONTROL_POINT_UUID, FTMS_SERVICE_UUID } from '../bleUuids';

jest.mock('../bleClient', () => ({
  bleManager: {
    connectToDevice: jest.fn(),
    cancelDeviceConnection: jest.fn(),
    isDeviceConnected: jest.fn().mockResolvedValue(false),
    connectedDevices: jest.fn().mockResolvedValue([]),
  },
}));

function encodeBase64Bytes(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

describe('ZiproRaveAdapter', () => {
  const DEVICE_ID = 'test-bike-123';
  let adapter: ZiproRaveAdapter;

  const createMockDevice = () => ({
    id: DEVICE_ID,
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
    (bleManager.isDeviceConnected as jest.Mock).mockResolvedValue(false);
    adapter = new ZiproRaveAdapter(DEVICE_ID);
  });

  describe('connect', () => {
    it('should connect to the device and discover services', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();

      expect(bleManager.connectToDevice).toHaveBeenCalledWith(DEVICE_ID, { timeout: 10000 });
      expect(mockDevice.discoverAllServicesAndCharacteristics).toHaveBeenCalled();
    });

    it('should drop a lingering native connection before reconnecting', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);
      (bleManager.isDeviceConnected as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await adapter.connect();

      expect(bleManager.cancelDeviceConnection).toHaveBeenCalledWith(DEVICE_ID);
      expect(bleManager.connectToDevice).toHaveBeenCalledWith(DEVICE_ID, { timeout: 10000 });
    });

    it('should reuse an existing validation connection when requested', async () => {
      const mockDevice = createMockDevice();
      (bleManager.isDeviceConnected as jest.Mock).mockResolvedValueOnce(true);
      (bleManager.connectedDevices as jest.Mock).mockResolvedValue([mockDevice]);

      await adapter.connect({ reuseExistingConnection: true });

      expect(bleManager.connectedDevices).toHaveBeenCalledWith([FTMS_SERVICE_UUID]);
      expect(bleManager.cancelDeviceConnection).not.toHaveBeenCalled();
      expect(bleManager.connectToDevice).not.toHaveBeenCalled();
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

    it('should wait until the bike is actually disconnected before resolving', async () => {
      jest.useFakeTimers();
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);
      (bleManager.isDeviceConnected as jest.Mock)
        .mockResolvedValueOnce(false) // connect()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await adapter.connect();

      const disconnectPromise = adapter.disconnect();

      await jest.advanceTimersByTimeAsync(200);
      await disconnectPromise;

      expect(bleManager.cancelDeviceConnection).toHaveBeenCalledWith(DEVICE_ID);
      expect(bleManager.isDeviceConnected).toHaveBeenCalledTimes(4);

      jest.useRealTimers();
    });

    it('should not cancel device connection if not connected', async () => {
      await adapter.disconnect();
      expect(bleManager.cancelDeviceConnection).not.toHaveBeenCalled();
    });

    it('should wait for an in-flight stop command before cancelling the BLE connection', async () => {
      const mockDevice = createMockDevice();
      let resolveWrite!: () => void;
      const writePromise = new Promise<void>((resolve) => {
        resolveWrite = resolve;
      });
      mockDevice.writeCharacteristicWithResponseForService.mockReturnValue(writePromise);
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);
      (bleManager.isDeviceConnected as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(false);

      await adapter.connect();
      const stopPromise = adapter.setControlState(BikeStatus.Stopped);
      const disconnectPromise = adapter.disconnect();

      expect(bleManager.cancelDeviceConnection).not.toHaveBeenCalled();

      resolveWrite();
      await stopPromise;
      await disconnectPromise;

      expect(bleManager.cancelDeviceConnection).toHaveBeenCalledWith(DEVICE_ID);
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
      // Flags (16-bit) -> 0x0174 -> Speed(0), Cadence(1), Distance(1), Resistance(1), Power(1), Energy(1)
      const mockBytes = new Uint8Array([0x74, 0x01, 14, 6, 170, 0, 176, 4, 0, 12, 0, 150, 0, 42, 0, 88, 2, 10]);
      const mockDataChar = { value: encodeBase64Bytes(mockBytes) };
      dataCallback(null, mockDataChar);

      expect(callback).toHaveBeenCalledWith({
        speed: 15.5,
        cadence: 85,
        power: 150,
        distance: 1200,
        resistance: 12,
        totalEnergyKcal: 42,
        energyPerHourKcal: 600,
        energyPerMinuteKcal: 10,
      });

      // 2. Simulate Machine Status Event: User Paused (0x02)
      const mockStatusBytes = new Uint8Array([0x02]);
      const mockStatusChar = { value: encodeBase64Bytes(mockStatusBytes) };
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
        FTMS_SERVICE_UUID,
        FTMS_CONTROL_POINT_UUID,
        'AA==',
      );
      expect(mockDevice.writeCharacteristicWithResponseForService).toHaveBeenNthCalledWith(
        2,
        FTMS_SERVICE_UUID,
        FTMS_CONTROL_POINT_UUID,
        'AQ==',
      );
      // Reset alone does not tear down BLE; the caller is expected to call disconnect() next.
      expect(bleManager.cancelDeviceConnection).not.toHaveBeenCalled();
      expect(bleManager.connectToDevice).toHaveBeenCalledTimes(1);
    });

    it('should leave the device connected after a successful reset so disconnect can tear down BLE', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      await adapter.setControlState(BikeStatus.Reset);
      await adapter.disconnect();

      expect(bleManager.cancelDeviceConnection).toHaveBeenCalledWith(DEVICE_ID);
    });

    it('should send start directly without requesting control first', async () => {
      const mockDevice = createMockDevice();
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      await adapter.setControlState(BikeStatus.Started);

      expect(mockDevice.writeCharacteristicWithResponseForService).toHaveBeenCalledTimes(1);
      expect(mockDevice.writeCharacteristicWithResponseForService).toHaveBeenCalledWith(
        FTMS_SERVICE_UUID,
        FTMS_CONTROL_POINT_UUID,
        'Bw==',
      );
    });

    it('should cleanup local state after reset when the write itself triggers a disconnect', async () => {
      const disconnectError = Object.assign(new Error(`Device ${DEVICE_ID} was disconnected`), { errorCode: 201 });
      const mockDevice = createMockDevice();
      mockDevice.writeCharacteristicWithResponseForService
        .mockResolvedValueOnce(undefined) // requestControl succeeds
        .mockRejectedValueOnce(disconnectError); // reset write triggers disconnect
      (bleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

      await adapter.connect();
      await adapter.setControlState(BikeStatus.Reset);

      // Adapter clears local state but does NOT issue BLE disconnect — bike already rebooting
      expect(bleManager.cancelDeviceConnection).not.toHaveBeenCalled();
      expect(bleManager.connectToDevice).toHaveBeenCalledTimes(1);
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
