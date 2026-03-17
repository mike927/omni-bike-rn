import type { Device, Subscription } from 'react-native-ble-plx';
import type { BikeAdapter, BikeMetrics } from './BikeAdapter';
import { bleManager } from './bleClient';
import { parseFtmsIndoorBikeData, parseFtmsMachineStatus } from './parsers/ftmsParser';

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

    // Standard FTMS Service, Indoor Bike Data Characteristic, and Machine Status Characteristic
    const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
    const CHAR_UUID_DATA = '00002ad2-0000-1000-8000-00805f9b34fb';
    const CHAR_UUID_STATUS = '00002ada-0000-1000-8000-00805f9b34fb';

    let latestMetrics: BikeMetrics = { speed: 0, cadence: 0, power: 0 };

    const dataSub = this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_UUID_DATA,
      (error, characteristic) => {
        if (error) {
          console.error('[ZiproRave] FTMS Data Monitoring error:', error);
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

            // Update latest metrics state
            latestMetrics = {
              ...latestMetrics,
              speed: parsedMetrics.speed ?? 0,
              cadence: parsedMetrics.cadence ?? 0,
              power: parsedMetrics.power ?? 0,
              ...(parsedMetrics.distance !== undefined && { distance: parsedMetrics.distance }),
              ...(parsedMetrics.resistance !== undefined && { resistance: parsedMetrics.resistance }),
              ...(parsedMetrics.heartRate !== undefined && { heartRate: parsedMetrics.heartRate }),
            };

            console.log('[ZiproRave] Decoded FTMS Metrics:', latestMetrics);
            callback(latestMetrics);
          } catch (err) {
            console.error('[ZiproRave] Error parsing FTMS metrics:', err);
          }
        }
      },
    );

    const statusSub = this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_UUID_STATUS,
      (error, characteristic) => {
        if (error) {
          console.error('[ZiproRave] FTMS Status Monitoring error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            const binaryString = atob(characteristic.value);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const statusEvent = parseFtmsMachineStatus(bytes);
            if (statusEvent) {
              latestMetrics = { ...latestMetrics, status: statusEvent };
              callback(latestMetrics);
            }
          } catch (err) {
            console.error('[ZiproRave] Error parsing FTMS status:', err);
          }
        }
      },
    );

    return {
      remove: () => {
        dataSub.remove();
        statusSub.remove();
      },
    };
  }
}
