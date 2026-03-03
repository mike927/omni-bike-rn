import type { Device, Subscription } from 'react-native-ble-plx';
import type { HrAdapter } from './HrAdapter';
import { bleManager } from './bleClient';
import { Buffer } from 'buffer';

const HR_SERVICE_UUID = '180d'; // Bluetooth SIG standard
const HR_MEASUREMENT_CHARACTERISTIC_UUID = '2a37'; // Bluetooth SIG standard

export class StandardHrAdapter implements HrAdapter {
  private device: Device | null = null;
  private readonly deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  async connect(): Promise<void> {
    this.device = await bleManager.connectToDevice(this.deviceId);
    await this.device.discoverAllServicesAndCharacteristics();
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
      HR_SERVICE_UUID,
      HR_MEASUREMENT_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('HR Monitor error:', error);
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
            console.error('Error parsing HR data:', err);
          }
        }
      },
    );
  }
}
