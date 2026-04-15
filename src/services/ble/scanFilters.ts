import { Buffer } from 'buffer';
import type { Device } from 'react-native-ble-plx';

import { HR_SERVICE_UUID, HR_SERVICE_UUID_SHORT } from './bleUuids';

/**
 * Bluetooth SIG "Assigned Numbers — Company Identifiers".
 *
 * Source: https://www.bluetooth.com/specifications/assigned-numbers/
 *
 * Every BLE advertisement that carries manufacturer-specific data encodes the
 * vendor as a 16-bit little-endian company ID in the first two bytes. We use
 * this as a defensive positive match for watches that already advertise with
 * non-HR service UUIDs (e.g. a vendor's proprietary 128-bit UUID) and would
 * otherwise fall through the "no services" branch.
 *
 * Keep this list conservative: only vendors whose product line is dominated
 * by HR-capable wearables. Do NOT add Apple, Samsung, Sony, etc. — those
 * ship phones, TVs, and headphones that would pollute the HR scan list.
 */
export const WEARABLE_VENDOR_COMPANY_IDS: ReadonlySet<number> = new Set<number>([
  0x0087, // Garmin International, Inc.
  0x006b, // Polar Electro Oy
  0x0157, // Anhui Huami Information Technology Co., Ltd. (Zepp / Amazfit)
  0x01e7, // Suunto Oy
  0x0553, // COROS Wearables Inc.
  0x0067, // Wahoo Fitness, LLC
]);

/**
 * Decode the first two little-endian bytes of a base64-encoded manufacturer
 * data blob into a 16-bit Bluetooth SIG Company Identifier.
 *
 * Returns `null` when no manufacturer data is present or the blob is too
 * short to contain a company ID (< 2 bytes).
 */
export function extractCompanyId(manufacturerDataBase64: string | null | undefined): number | null {
  if (!manufacturerDataBase64) return null;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(manufacturerDataBase64, 'base64');
  } catch {
    return null;
  }

  if (bytes.length < 2) return null;

  // Little-endian: byte[0] is the low byte, byte[1] is the high byte.
  const lo = bytes[0] ?? 0;
  const hi = bytes[1] ?? 0;
  return (hi << 8) | lo;
}

function advertisementExposesHrService(serviceUUIDs: readonly string[] | null | undefined): boolean {
  if (!serviceUUIDs || serviceUUIDs.length === 0) return false;
  return serviceUUIDs.some((uuid) => {
    const normalized = uuid.toLowerCase();
    return normalized === HR_SERVICE_UUID || normalized === HR_SERVICE_UUID_SHORT;
  });
}

/**
 * Client-side filter for the HR gear-setup scan list.
 *
 * ## Why this exists
 *
 * Omni Bike intentionally does NOT pass a service-UUID filter to the OS for
 * HR scanning (see `useGearSetup.ts` → `HR_SCAN_SERVICE_FILTER`). iOS
 * `CBCentralManager.scanForPeripherals(withServices:)` filters strictly by
 * service UUIDs contained in the advertisement packet, and Garmin watches in
 * HR Broadcast mode (Venu, Forerunner, Fenix, etc.) do NOT advertise
 * `0x180D` — they only expose it through GATT after connection. Filtering at
 * the OS level therefore silently drops every Garmin watch, so we scan
 * broadly and filter client-side here.
 *
 * The unfiltered iOS scan returns laptops, TVs, headphones, and nearby
 * phones. This predicate removes them without re-introducing the bug that
 * hides Garmin watches.
 *
 * ## Accept rules (device is shown if ANY hold)
 *
 *   1. Advertisement exposes the standard BLE HR service UUID. Covers every
 *      compliant chest strap (Garmin HRM-Dual, Polar H10, Wahoo TICKR, etc.).
 *   2. Manufacturer Specific Data starts with a known wearable vendor
 *      Company ID (Garmin, Polar, Suunto, COROS, Amazfit, Wahoo). Defensive
 *      positive match for watches whose broadcast advertisement contains
 *      vendor-proprietary services but not `0x180D`.
 *   3. Advertisement exposes NO service UUIDs at all. Empirically what
 *      Garmin Venu (gen 1) does in HR Broadcast mode: empty service UUID
 *      list, often no manufacturer data either. Laptops, TVs, and headphones
 *      effectively always advertise *something* (Apple Continuity,
 *      AirPlay, A2DP, etc.), so this branch is safe to take as a positive.
 *
 * ## Not authoritative
 *
 * This filter only reduces list noise. The authoritative gate is the
 * post-connection `validateHrDevice` check, which verifies that the selected
 * peripheral actually exposes `0x180D` / `0x2A37` via GATT. If the user
 * manages to pick a false-positive from this list, the existing
 * `missing_hr_service` error path (with recovery hint) handles it.
 */
export function isLikelyHrCandidate(device: Device): boolean {
  if (advertisementExposesHrService(device.serviceUUIDs)) return true;

  const companyId = extractCompanyId(device.manufacturerData);
  if (companyId !== null && WEARABLE_VENDOR_COMPANY_IDS.has(companyId)) return true;

  return !device.serviceUUIDs || device.serviceUUIDs.length === 0;
}
