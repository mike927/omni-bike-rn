import type { Device, Subscription } from 'react-native-ble-plx';
import { BikeStatus, type BikeAdapter, type BikeMetrics } from './BikeAdapter';
import type { BleError } from './BleError';
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
  private hasControl = false;
  private metricsCallback: ((metrics: BikeMetrics) => void) | null = null;
  private dataSub: Subscription | null = null;
  private statusSub: Subscription | null = null;
  private latestMetrics: BikeMetrics = { speed: 0, cadence: 0, power: 0 };
  private static readonly OPERATION_CANCELLED_ERROR_CODE = 2;
  private static readonly DEVICE_DISCONNECTED_ERROR_CODE = 201;

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
    this.hasControl = false;
  }

  /**
   * Gracefully tears down the active BLE connection and clears the internal
   * device reference. Safe to call even if the device is already disconnected.
   */
  async disconnect(): Promise<void> {
    this.clearMetricSubscriptions();

    if (this.device) {
      await bleManager.cancelDeviceConnection(this.deviceId);
      this.device = null;
      this.hasControl = false;
    }
  }

  private clearMetricSubscriptions(): void {
    this.dataSub?.remove();
    this.statusSub?.remove();
    this.dataSub = null;
    this.statusSub = null;
  }

  private isExpectedMonitorCancellation(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const bleError = error as BleError;
    return (
      bleError.errorCode === ZiproRaveAdapter.OPERATION_CANCELLED_ERROR_CODE ||
      bleError.message.includes('Operation was cancelled')
    );
  }

  private isExpectedControlDisconnect(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const bleError = error as BleError;
    return (
      bleError.errorCode === ZiproRaveAdapter.DEVICE_DISCONNECTED_ERROR_CODE ||
      bleError.message.includes('was disconnected')
    );
  }

  private async writeControlCommand(command: number[]): Promise<void> {
    if (!this.device) {
      throw new Error('Device not connected');
    }

    const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
    const CHAR_UUID_CONTROL_POINT = '00002ad9-0000-1000-8000-00805f9b34fb';

    const base64Cmd =
      typeof Buffer !== 'undefined' ? Buffer.from(command).toString('base64') : btoa(String.fromCharCode(...command));

    await this.device.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID_CONTROL_POINT, base64Cmd);
  }

  private async requestControlIfNeeded(): Promise<void> {
    if (!this.device || this.hasControl) {
      return;
    }

    try {
      await this.writeControlCommand([FtmsControlPointOpCode.RequestControl]);
      this.hasControl = true;
    } catch (err) {
      console.warn('[ZiproRave] Request control failed, continuing with direct command:', err);
    }
  }

  private startMetricSubscriptions(): void {
    if (!this.device || !this.metricsCallback) {
      throw new Error('Device not connected');
    }

    const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
    const CHAR_UUID_DATA = '00002ad2-0000-1000-8000-00805f9b34fb';
    const CHAR_UUID_STATUS = '00002ada-0000-1000-8000-00805f9b34fb';

    this.clearMetricSubscriptions();
    this.latestMetrics = { speed: 0, cadence: 0, power: 0 };

    this.dataSub = this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_UUID_DATA,
      (error, characteristic) => {
        if (error) {
          if (this.isExpectedMonitorCancellation(error)) {
            return;
          }
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

            this.latestMetrics = {
              ...this.latestMetrics,
              speed: parsedMetrics.speed ?? 0,
              cadence: parsedMetrics.cadence ?? 0,
              power: parsedMetrics.power ?? 0,
              ...(parsedMetrics.distance !== undefined && { distance: parsedMetrics.distance }),
              ...(parsedMetrics.resistance !== undefined && { resistance: parsedMetrics.resistance }),
              ...(parsedMetrics.heartRate !== undefined && { heartRate: parsedMetrics.heartRate }),
            };

            console.warn('[ZiproRave] Decoded FTMS Metrics:', this.latestMetrics);
            this.metricsCallback?.(this.latestMetrics);
          } catch (err) {
            console.error('[ZiproRave] Error parsing FTMS metrics:', err);
          }
        }
      },
    );

    this.statusSub = this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_UUID_STATUS,
      (error, characteristic) => {
        if (error) {
          if (this.isExpectedMonitorCancellation(error)) {
            return;
          }
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
              this.latestMetrics = { ...this.latestMetrics, status: statusEvent };
              this.metricsCallback?.(this.latestMetrics);
            }
          } catch (err) {
            console.error('[ZiproRave] Error parsing FTMS status:', err);
          }
        }
      },
    );
  }

  private async reconnectAfterReset(): Promise<void> {
    const shouldResumeMetrics = this.metricsCallback !== null;

    await this.disconnect();
    await this.connect();

    if (shouldResumeMetrics) {
      this.startMetricSubscriptions();
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
    this.metricsCallback = callback;
    this.startMetricSubscriptions();

    return {
      remove: () => {
        this.metricsCallback = null;
        this.clearMetricSubscriptions();
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
        if (status === BikeStatus.Reset) {
          await this.requestControlIfNeeded();
        }
        await this.writeControlCommand(command);
        if (status === BikeStatus.Reset) {
          this.hasControl = false;
          await this.reconnectAfterReset();
        }
        console.warn(`[ZiproRave] Successfully sent control state: ${status}`);
      }
    } catch (err) {
      if (this.isExpectedControlDisconnect(err)) {
        return;
      }
      console.error('[ZiproRave] Failed to set control state:', err);
    }
  }
}
