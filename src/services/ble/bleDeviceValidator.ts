import { bleManager } from './bleClient';
import type { GearValidationResult } from '../../types/gear';

const FTMS_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_CHARACTERISTIC = '00002ad2-0000-1000-8000-00805f9b34fb';
const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_MEASUREMENT_CHARACTERISTIC = '00002a37-0000-1000-8000-00805f9b34fb';

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

    if (!serviceUUIDs.includes(FTMS_SERVICE)) {
      return { valid: false, reason: 'missing_ftms_service' };
    }

    const characteristics = await device.characteristicsForService(FTMS_SERVICE);
    const charUUIDs = characteristics.map((c) => c.uuid.toLowerCase());

    if (!charUUIDs.includes(INDOOR_BIKE_CHARACTERISTIC)) {
      return { valid: false, reason: 'missing_indoor_bike_characteristic' };
    }

    return { valid: true };
  } catch (err: unknown) {
    console.error('[bleDeviceValidator] Bike validation error:', err);
    return { valid: false, reason: 'missing_ftms_service' };
  } finally {
    if (connected) {
      await disconnect(deviceId);
    }
  }
}

export async function validateHrDevice(deviceId: string): Promise<GearValidationResult> {
  let connected = false;
  try {
    const device = await connectAndDiscover(deviceId);
    connected = true;

    const services = await device.services();
    const serviceUUIDs = services.map((s) => s.uuid.toLowerCase());

    if (!serviceUUIDs.includes(HR_SERVICE)) {
      return { valid: false, reason: 'missing_hr_service' };
    }

    const characteristics = await device.characteristicsForService(HR_SERVICE);
    const charUUIDs = characteristics.map((c) => c.uuid.toLowerCase());

    if (!charUUIDs.includes(HR_MEASUREMENT_CHARACTERISTIC)) {
      return { valid: false, reason: 'missing_hr_characteristic' };
    }

    return { valid: true };
  } catch (err: unknown) {
    console.error('[bleDeviceValidator] HR validation error:', err);
    return { valid: false, reason: 'missing_hr_service' };
  } finally {
    if (connected) {
      await disconnect(deviceId);
    }
  }
}
