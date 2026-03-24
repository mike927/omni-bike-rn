import { BikeStatus, type BikeMetrics } from '../BikeAdapter';

export enum FtmsMachineStatusOpCode {
  Reset = 0x01,
  StoppedOrPausedByUser = 0x02,
  StartedOrResumedZipro = 0x04,
  TargetResistanceChanged = 0x07,
  SpeedRangeChanged = 0x08,
  SpinDownStatus = 0x0a,
}

export enum FtmsControlPointOpCode {
  RequestControl = 0x00,
  Reset = 0x01,
  SetTargetResistance = 0x04,
  SetTargetPower = 0x05,
  StartOrResume = 0x07,
  StopOrPause = 0x08,
}

export enum FtmsStopPauseCmd {
  Stop = 0x01,
  Pause = 0x02,
}

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

  let distance: number | undefined;
  // Total Distance is present if Bit 4 is 1 (24-bit UINT)
  if ((flags & 0x0010) !== 0 && offset + 2 < bytes.length) {
    distance = bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
    offset += 3;
  }

  let resistance: number | undefined;
  // Resistance Level is present if Bit 5 is 1 (SINT16)
  if ((flags & 0x0020) !== 0 && offset + 1 < bytes.length) {
    const rawResist = bytes[offset]! | (bytes[offset + 1]! << 8);
    // Handle signed 16-bit integer
    resistance = rawResist >= 32768 ? rawResist - 65536 : rawResist;
    offset += 2;
  }

  let power: number | undefined;
  // Instantaneous Power is present if Bit 6 is 1 (SINT16)
  if ((flags & 0x0040) !== 0 && offset + 1 < bytes.length) {
    const rawPower = bytes[offset]! | (bytes[offset + 1]! << 8);
    power = rawPower >= 32768 ? rawPower - 65536 : rawPower;
    offset += 2;
  }

  let heartRate: number | undefined;
  // Heart Rate is present if Bit 9 is 1 (UINT8)
  if ((flags & 0x0200) !== 0 && offset < bytes.length) {
    heartRate = bytes[offset]!;
    offset += 1;
  }

  // Energy is present if Bit 10 is 1 (UINT16 x 5)
  // Elapsed Time is present if Bit 11 is 1 (UINT16)

  return {
    ...(speed !== undefined && { speed }),
    ...(cadence !== undefined && { cadence }),
    ...(power !== undefined && { power }),
    ...(distance !== undefined && { distance }),
    ...(resistance !== undefined && { resistance }),
    ...(heartRate !== undefined && { heartRate }),
  };
}

/**
 * Parses a standard Bluetooth Fitness Machine Service (FTMS) Machine Status payload.
 *
 * This characteristic broadcasts events like "Start/Resume", "Stop/Pause",
 * and "Fitness Machine Started".
 *
 * @param bytes The Uint8Array containing the raw Machine Status payload
 * @returns A BikeStatus enum if recognized, otherwise undefined.
 */
export function parseFtmsMachineStatus(bytes: Uint8Array): BikeStatus | undefined {
  if (bytes.length < 1) return undefined;

  const opCode = bytes[0] as FtmsMachineStatusOpCode;

  switch (opCode) {
    case FtmsMachineStatusOpCode.Reset:
    case FtmsMachineStatusOpCode.StoppedOrPausedByUser:
      return BikeStatus.Stopped;
    case FtmsMachineStatusOpCode.StartedOrResumedZipro:
      return BikeStatus.Started;
    default:
      // Zipro emits non-state events such as resistance changes; those should not
      // drive the workout state machine unless we verify a stable mapping.
      return undefined;
  }
}
