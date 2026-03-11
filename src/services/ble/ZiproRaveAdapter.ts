import type { Device, Subscription } from 'react-native-ble-plx';
import type { BikeAdapter, BikeMetrics } from './BikeAdapter';
import { bleManager } from './bleClient';

export class ZiproRaveAdapter implements BikeAdapter {
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

  subscribeToMetrics(_callback: (metrics: BikeMetrics) => void): Subscription {
    if (!this.device) {
      throw new Error('Device not connected');
    }

    // TODO: Determine correct Service UUID and Characteristic UUID for Zipro Rave.
    // For now, returning a dummy subscription.
    return {
      remove: () => {},
    };
  }
}
