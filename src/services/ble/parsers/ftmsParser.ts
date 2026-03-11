import type { BikeMetrics } from '../BikeAdapter';

/**
 * Parses a standard Bluetooth Fitness Machine Service (FTMS) Indoor Bike Data payload.
 *
 * This implementation reads the standard 16-bit flags at the beginning of the payload
 * to determine which metrics are present and dynamically offsets through the bit array
 * to decode speed, cadence, and power.
 *
 * @param bytes The Uint8Array containing the raw FTMS payload data
 * @returns A partial subset of standard BikeMetrics extracted from the payload
 */
export function parseFtmsIndoorBikeData(bytes: Uint8Array): Partial<BikeMetrics> {
  if (bytes.length < 2) {
    return {};
  }

  const flags = bytes[0]! | (bytes[1]! << 8);
  let offset = 2;

  let speed: number | undefined;
  // Instantaneous Speed is present if More Data (Bit 0) is 0
  if ((flags & 0x0001) === 0 && offset + 1 < bytes.length) {
    speed = (bytes[offset]! | (bytes[offset + 1]! << 8)) / 100;
    offset += 2;
  }

  // Average Speed is present if Bit 1 is 1
  if ((flags & 0x0002) !== 0) {
    offset += 2;
  }

  let cadence: number | undefined;
  // Instantaneous Cadence is present if Bit 2 is 1
  if ((flags & 0x0004) !== 0 && offset + 1 < bytes.length) {
    cadence = (bytes[offset]! | (bytes[offset + 1]! << 8)) / 2;
    offset += 2;
  }

  // Average Cadence is present if Bit 3 is 1
  if ((flags & 0x0008) !== 0) {
    offset += 2;
  }

  // Total Distance is present if Bit 4 is 1
  if ((flags & 0x0010) !== 0) {
    offset += 3; // 24-bit UINT
  }

  // Resistance Level is present if Bit 5 is 1
  if ((flags & 0x0020) !== 0) {
    offset += 2; // INT16
  }

  let power: number | undefined;
  // Instantaneous Power is present if Bit 6 is 1
  if ((flags & 0x0040) !== 0 && offset + 1 < bytes.length) {
    power = bytes[offset]! | (bytes[offset + 1]! << 8); // SINT16
    offset += 2;
  }

  // There are more flags (Heart Rate, Energy, Elapsed Time)
  // that can be added here if needed in the future.

  return {
    ...(speed !== undefined && { speed }),
    ...(cadence !== undefined && { cadence }),
    ...(power !== undefined && { power }),
  };
}
