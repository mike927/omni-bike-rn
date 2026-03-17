import type { Device, Subscription } from 'react-native-ble-plx';
import type { BikeAdapter, BikeMetrics } from './BikeAdapter';
import { bleManager } from './bleClient';
import { parseFtmsIndoorBikeData } from './parsers/ftmsParser';

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

  subscribeToMetrics(callback: (metrics: BikeMetrics) => void): Subscription {
    if (!this.device) {
      console.error('[ZiproRave] Failed to subscribe: Device is not connected!');
      throw new Error('Device not connected');
    }

    // Standard FTMS Service and Indoor Bike Data Characteristic
    const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
    const CHAR_UUID = '00002ad2-0000-1000-8000-00805f9b34fb';

    console.log(`[ZiproRave] Subscribing to FTMS Indoor Bike Data (${CHAR_UUID})...`);

    return this.device.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (error, characteristic) => {
      if (error) {
        console.error('[ZiproRave] FTMS Monitoring error:', error);
        return;
      }

      if (characteristic?.value) {
        try {
          const binaryString = atob(characteristic.value);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const parsedMetrics = parseFtmsIndoorBikeData(bytes);

          // Our App's domain model requires numbers for core metrics, but the parser returns a partial optionally-undefined object.
          // We'll fill in zeros for any core sensors the bike didn't report, and pass through the optional ones.
          const metrics: BikeMetrics = {
            speed: parsedMetrics.speed ?? 0,
            cadence: parsedMetrics.cadence ?? 0,
            power: parsedMetrics.power ?? 0,
            distance: parsedMetrics.distance,
            resistance: parsedMetrics.resistance,
            heartRate: parsedMetrics.heartRate,
          };

          callback(metrics);
        } catch (err) {
          console.error('[ZiproRave] Error parsing FTMS metrics:', err);
        }
      }
    });
  }
}
