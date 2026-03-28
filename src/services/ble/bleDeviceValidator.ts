import { bleManager } from './bleClient';
import type { GearValidationResult } from '../../types/gear';
import {
  FTMS_INDOOR_BIKE_DATA_UUID,
  FTMS_SERVICE_UUID,
  HR_MEASUREMENT_CHARACTERISTIC_UUID,
  HR_SERVICE_UUID,
} from './bleUuids';

async function connectAndDiscover(deviceId: string) {
  const device = await bleManager.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();
  return device;
}

async function disconnect(deviceId: string): Promise<void> {
  try {
    await bleManager.cancelDeviceConnection(deviceId);
  } catch (err: unknown) {
    console.error('[bleDeviceValidator] Disconnect error:', err);
  }
}

export async function validateBikeDevice(deviceId: string): Promise<GearValidationResult> {
  let connected = false;
  try {
    const device = await connectAndDiscover(deviceId);
    connected = true;

    const services = await device.services();
    const serviceUUIDs = services.map((s) => s.uuid.toLowerCase());

    if (!serviceUUIDs.includes(FTMS_SERVICE_UUID)) {
      await disconnect(deviceId);
      return { valid: false, reason: 'missing_ftms_service' };
    }

    const characteristics = await device.characteristicsForService(FTMS_SERVICE_UUID);
    const charUUIDs = characteristics.map((c) => c.uuid.toLowerCase());

    if (!charUUIDs.includes(FTMS_INDOOR_BIKE_DATA_UUID)) {
      await disconnect(deviceId);
      return { valid: false, reason: 'missing_indoor_bike_characteristic' };
    }

    // Keep connection alive — the adapter will reuse it
    return { valid: true };
  } catch (err: unknown) {
    console.error('[bleDeviceValidator] Bike validation error:', err);
    if (connected) {
      await disconnect(deviceId);
    }
    return { valid: false, reason: 'connection_failed' };
  }
}

export async function validateHrDevice(deviceId: string): Promise<GearValidationResult> {
  let connected = false;
  try {
    const device = await connectAndDiscover(deviceId);
    connected = true;

    const services = await device.services();
    const serviceUUIDs = services.map((s) => s.uuid.toLowerCase());

    if (!serviceUUIDs.includes(HR_SERVICE_UUID)) {
      await disconnect(deviceId);
      return { valid: false, reason: 'missing_hr_service' };
    }

    const characteristics = await device.characteristicsForService(HR_SERVICE_UUID);
    const charUUIDs = characteristics.map((c) => c.uuid.toLowerCase());

    if (!charUUIDs.includes(HR_MEASUREMENT_CHARACTERISTIC_UUID)) {
      await disconnect(deviceId);
      return { valid: false, reason: 'missing_hr_characteristic' };
    }

    // Keep connection alive — the adapter will reuse it
    return { valid: true };
  } catch (err: unknown) {
    console.error('[bleDeviceValidator] HR validation error:', err);
    if (connected) {
      await disconnect(deviceId);
    }
    return { valid: false, reason: 'connection_failed' };
  }
}
