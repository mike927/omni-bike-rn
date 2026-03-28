import type { Device, Subscription } from 'react-native-ble-plx';
import type { HrAdapter } from './HrAdapter';
import { bleManager } from './bleClient';
import { connectToBleDeviceWithOptions } from './bleConnectionUtils';
import { Buffer } from 'buffer';
import type { BleConnectionOptions } from './BleConnectionOptions';
import { HR_MEASUREMENT_CHARACTERISTIC_UUID_SHORT, HR_SERVICE_UUID, HR_SERVICE_UUID_SHORT } from './bleUuids';
import { isExpectedBleDisconnectError } from './isExpectedBleDisconnectError';

export class StandardHrAdapter implements HrAdapter {
  private device: Device | null = null;
  private readonly deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  async connect(options?: BleConnectionOptions): Promise<void> {
    this.device = await connectToBleDeviceWithOptions(this.deviceId, {
      ...options,
      connectedServiceUuids: [HR_SERVICE_UUID],
    });

    try {
      await this.device.discoverAllServicesAndCharacteristics();
    } catch (err) {
      await this.disconnect();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      await bleManager.cancelDeviceConnection(this.deviceId);
      this.device = null;
    }
  }

  subscribeToHeartRate(callback: (hr: number) => void): Subscription {
    if (!this.device) {
      throw new Error('Device not connected');
    }

    return bleManager.monitorCharacteristicForDevice(
      this.deviceId,
      HR_SERVICE_UUID_SHORT,
      HR_MEASUREMENT_CHARACTERISTIC_UUID_SHORT,
      (error, characteristic) => {
        if (error) {
          if (isExpectedBleDisconnectError(error)) {
            return;
          }
          console.error('[StandardHrAdapter] HR monitor error:', error);
          return;
        }
        if (characteristic?.value) {
          try {
            const buffer = Buffer.from(characteristic.value, 'base64');
            const flags = buffer.readUInt8(0);
            const isUint16 = (flags & 0x01) !== 0; // 0th bit of flags determines format
            const hr = isUint16 ? buffer.readUInt16LE(1) : buffer.readUInt8(1);
            callback(hr);
          } catch (err) {
            console.error('[StandardHrAdapter] Error parsing HR data:', err);
          }
        }
      },
    );
  }
}
