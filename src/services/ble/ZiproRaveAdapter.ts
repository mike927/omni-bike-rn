import type { Device, Subscription } from 'react-native-ble-plx';
import { BikeStatus, type BikeAdapter, type BikeMetrics } from './BikeAdapter';
import { bleManager } from './bleClient';
import { connectToBleDeviceWithOptions, waitForBleDeviceDisconnect } from './bleConnectionUtils';
import { isExpectedBleDisconnectError } from './isExpectedBleDisconnectError';
import type { BleConnectionOptions } from './BleConnectionOptions';
import {
  FTMS_CONTROL_POINT_UUID,
  FTMS_INDOOR_BIKE_DATA_UUID,
  FTMS_MACHINE_STATUS_UUID,
  FTMS_SERVICE_UUID,
} from './bleUuids';
import {
  parseFtmsIndoorBikeData,
  parseFtmsMachineStatus,
  FtmsControlPointOpCode,
  FtmsStopPauseCmd,
} from './parsers/ftmsParser';

const CONTROL_COMMAND_DRAIN_TIMEOUT_MS = 2000;

export class ZiproRaveAdapter implements BikeAdapter {
  private device: Device | null = null;
  private readonly deviceId: string;
  private hasControl = false;
  private metricsCallback: ((metrics: BikeMetrics) => void) | null = null;
  private dataSub: Subscription | null = null;
  private statusSub: Subscription | null = null;
  private latestMetrics: BikeMetrics = { speed: 0, cadence: 0, power: 0 };
  private commandQueue: Promise<void> = Promise.resolve();

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
  async connect(options?: BleConnectionOptions): Promise<void> {
    this.device = await connectToBleDeviceWithOptions(this.deviceId, {
      ...options,
      connectedServiceUuids: [FTMS_SERVICE_UUID],
    });

    try {
      await this.device.discoverAllServicesAndCharacteristics();
    } catch (err) {
      await this.disconnect();
      throw err;
    }

    this.hasControl = false;
  }

  /**
   * Gracefully tears down the active BLE connection and clears the internal
   * device reference. Safe to call even if the device is already disconnected.
   */
  async disconnect(): Promise<void> {
    this.clearMetricSubscriptions();

    if (this.device) {
      let disconnectError: unknown = null;

      await this.waitForPendingControlCommands();

      try {
        await bleManager.cancelDeviceConnection(this.deviceId);
      } catch (err) {
        disconnectError = err;
      }

      try {
        await this.waitForDeviceDisconnect();
      } finally {
        this.device = null;
        this.hasControl = false;
      }

      if (disconnectError && !isExpectedBleDisconnectError(disconnectError)) {
        throw disconnectError;
      }
    } else {
      this.hasControl = false;
    }
  }

  private async waitForPendingControlCommands(): Promise<void> {
    await Promise.race([
      this.commandQueue,
      new Promise<void>((resolve) => {
        setTimeout(resolve, CONTROL_COMMAND_DRAIN_TIMEOUT_MS);
      }),
    ]);
  }

  private async waitForDeviceDisconnect(): Promise<void> {
    await waitForBleDeviceDisconnect(this.deviceId);
  }

  private clearMetricSubscriptions(): void {
    this.dataSub?.remove();
    this.statusSub?.remove();
    this.dataSub = null;
    this.statusSub = null;
  }

  private async writeControlCommand(command: number[]): Promise<void> {
    if (!this.device) {
      throw new Error('Device not connected');
    }

    const base64Cmd =
      typeof Buffer === 'undefined' ? btoa(String.fromCharCode(...command)) : Buffer.from(command).toString('base64');

    await this.device.writeCharacteristicWithResponseForService(FTMS_SERVICE_UUID, FTMS_CONTROL_POINT_UUID, base64Cmd);
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

    // Uses module-level FTMS UUID constants

    this.clearMetricSubscriptions();
    this.latestMetrics = { speed: 0, cadence: 0, power: 0 };

    this.dataSub = this.device.monitorCharacteristicForService(
      FTMS_SERVICE_UUID,
      FTMS_INDOOR_BIKE_DATA_UUID,
      (error, characteristic) => {
        if (error) {
          if (isExpectedBleDisconnectError(error)) {
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
              ...(parsedMetrics.distance !== undefined && {
                distance: parsedMetrics.distance,
              }),
              ...(parsedMetrics.resistance !== undefined && {
                resistance: parsedMetrics.resistance,
              }),
              ...(parsedMetrics.heartRate !== undefined && {
                heartRate: parsedMetrics.heartRate,
              }),
              ...(parsedMetrics.totalEnergyKcal !== undefined && {
                totalEnergyKcal: parsedMetrics.totalEnergyKcal,
              }),
              ...(parsedMetrics.energyPerHourKcal !== undefined && {
                energyPerHourKcal: parsedMetrics.energyPerHourKcal,
              }),
              ...(parsedMetrics.energyPerMinuteKcal !== undefined && {
                energyPerMinuteKcal: parsedMetrics.energyPerMinuteKcal,
              }),
            };

            this.metricsCallback?.(this.latestMetrics);
          } catch (err) {
            console.error('[ZiproRave] Error parsing FTMS metrics:', err);
          }
        }
      },
    );

    this.statusSub = this.device.monitorCharacteristicForService(
      FTMS_SERVICE_UUID,
      FTMS_MACHINE_STATUS_UUID,
      (error, characteristic) => {
        if (error) {
          if (isExpectedBleDisconnectError(error)) {
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
              this.latestMetrics = {
                ...this.latestMetrics,
                status: statusEvent,
              };
              this.metricsCallback?.(this.latestMetrics);
            }
          } catch (err) {
            console.error('[ZiproRave] Error parsing FTMS status:', err);
          }
        }
      },
    );
  }

  private cleanupAfterReset(): void {
    // After a Reset command the bike hardware may reboot. Clear local state
    // (subscriptions, device ref) but do NOT explicitly disconnect BLE — let
    // the connection drop naturally if the bike reboots. Auto-reconnect will
    // re-establish from scratch.
    this.clearMetricSubscriptions();
    this.device = null;
    this.hasControl = false;
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
    // Serialize all control commands through a queue so a fire-and-forget
    // Stopped write finishes before a subsequent Reset write begins.
    const task = this.commandQueue.then(() => this.executeControlState(status));
    this.commandQueue = task.catch(() => {});
    return task;
  }

  private async executeControlState(status: BikeStatus): Promise<void> {
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
          this.cleanupAfterReset();
        }
      }
    } catch (err) {
      if (isExpectedBleDisconnectError(err)) {
        if (status === BikeStatus.Reset) {
          this.cleanupAfterReset();
        }
        return;
      }
      console.error('[ZiproRave] Failed to set control state:', err);
    }
  }
}
