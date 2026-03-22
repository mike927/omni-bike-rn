import type { Device, Subscription } from 'react-native-ble-plx';
import type { BikeAdapter, BikeMetrics, BikeStatus } from './BikeAdapter';
import { bleManager } from './bleClient';
import {
  parseFtmsIndoorBikeData,
  parseFtmsMachineStatus,
  FtmsControlPointOpCode,
  FtmsStopPauseCmd,
} from './parsers/ftmsParser';

export class ZiproRaveAdapter implements BikeAdapter {
  private device: Device | null = null;
  private readonly deviceId: string;

  /**
   * Initializes the adapter for a specific BLE device ID without connecting.
   *
   * @param deviceId The unique MAC address or UUID of the physical bike.
   */
  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  /**
   * Connects to the physical hardware and discovers its available services
   * and characteristics. Must be called before subscribing or sending commands.
   */
  async connect(): Promise<void> {
    this.device = await bleManager.connectToDevice(this.deviceId);
    await this.device.discoverAllServicesAndCharacteristics();
  }

  /**
   * Gracefully tears down the active BLE connection and clears the internal
   * device reference. Safe to call even if the device is already disconnected.
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      await bleManager.cancelDeviceConnection(this.deviceId);
      this.device = null;
    }
  }

  /**
   * Opens active subscriptions to the bike's FTMS characteristics to receive live data.
   * - Monitors `Indoor Bike Data` for speed, cadence, distance, and power metrics.
   * - Monitors `Machine Status` for hardware-initiated start/pause events.
   *
   * @param callback Function triggered every time new metrics are broadcast by the bike.
   * @returns A Subscription object with a `remove()` method to clean up listeners.
   */
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

  /**
   * Sends explicit commands to the bike's hardware using the FTMS Control Point.
   * Used when the user clicks 'Start', 'Pause', or 'Stop' in the mobile app so the
   * physical console stays perfectly synchronized with the app's state.
   *
   * @param status The target status ('started', 'paused', 'stopped', 'reset') to command.
   */
  async setControlState(status: BikeStatus): Promise<void> {
    if (!this.device) {
      console.warn('[ZiproRave] Cannot set control state: device not connected');
      return;
    }

    const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
    const CHAR_UUID_CONTROL_POINT = '00002ad9-0000-1000-8000-00805f9b34fb';

    try {
      let command: number[] | null = null;
      if (status === 'started') {
        command = [FtmsControlPointOpCode.StartOrResume];
      } else if (status === 'paused') {
        command = [FtmsControlPointOpCode.StopOrPause, FtmsStopPauseCmd.Pause];
      } else if (status === 'stopped') {
        command = [FtmsControlPointOpCode.StopOrPause, FtmsStopPauseCmd.Stop];
      } else if (status === 'reset') {
        command = [FtmsControlPointOpCode.Reset];
      }

      if (command) {
        // Many fitness machines crash or drop the BLE connection if you send the
        // strict "Gain Control" (0x00) FTMS preamble. We send the action command directly.

        // Base64 encode the command array
        // (Buffer is available in typical RN environments; btoa can fail with raw bytes)
        let base64Cmd = '';
        if (typeof Buffer !== 'undefined') {
          base64Cmd = Buffer.from(command).toString('base64');
        } else {
          base64Cmd = btoa(String.fromCharCode(...command));
        }

        await this.device.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID_CONTROL_POINT, base64Cmd);
        console.log(`[ZiproRave] Successfully sent control state: ${status}`);
      }
    } catch (err) {
      console.error('[ZiproRave] Failed to set control state:', err);
    }
  }
}
