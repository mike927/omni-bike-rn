import type { Device } from 'react-native-ble-plx';

import { bleManager } from './bleClient';
import { isExpectedBleDisconnectError } from './isExpectedBleDisconnectError';
import type { BleConnectionOptions } from './BleConnectionOptions';

const BLE_CONNECT_TIMEOUT_MS = 10000;
const BLE_DISCONNECT_TIMEOUT_MS = 5000;
const BLE_DISCONNECT_POLL_INTERVAL_MS = 100;

export interface ConnectToBleDeviceOptions extends BleConnectionOptions {
  connectedServiceUuids?: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForBleDeviceDisconnect(
  deviceId: string,
  timeoutMs: number = BLE_DISCONNECT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const stillConnected = await bleManager.isDeviceConnected(deviceId);
    if (!stillConnected) {
      return;
    }

    await delay(BLE_DISCONNECT_POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out disconnecting BLE device ${deviceId}`);
}

export async function prepareBleDeviceForConnection(deviceId: string): Promise<void> {
  const alreadyConnected = await bleManager.isDeviceConnected(deviceId);
  if (!alreadyConnected) {
    return;
  }

  try {
    await bleManager.cancelDeviceConnection(deviceId);
  } catch (err: unknown) {
    if (!isExpectedBleDisconnectError(err)) {
      throw err;
    }
  }

  await waitForBleDeviceDisconnect(deviceId);
}

export async function connectToBleDevice(deviceId: string): Promise<Device> {
  await prepareBleDeviceForConnection(deviceId);
  return bleManager.connectToDevice(deviceId, { timeout: BLE_CONNECT_TIMEOUT_MS });
}

export async function connectToBleDeviceWithOptions(
  deviceId: string,
  options?: ConnectToBleDeviceOptions,
): Promise<Device> {
  if (options?.reuseExistingConnection) {
    const alreadyConnected = await bleManager.isDeviceConnected(deviceId);

    if (alreadyConnected && options.connectedServiceUuids?.length) {
      const connectedDevice =
        (await bleManager.connectedDevices(options.connectedServiceUuids)).find((device) => device.id === deviceId) ??
        null;

      if (connectedDevice) {
        return connectedDevice;
      }
    }
  }

  await prepareBleDeviceForConnection(deviceId);
  return bleManager.connectToDevice(deviceId, { timeout: BLE_CONNECT_TIMEOUT_MS });
}
