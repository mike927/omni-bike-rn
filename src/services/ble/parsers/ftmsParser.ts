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

function readUint8(bytes: Uint8Array, offset: number): number | undefined {
  return offset < bytes.length ? bytes[offset] : undefined;
}

function readUint16LE(bytes: Uint8Array, offset: number): number | undefined {
  const low = readUint8(bytes, offset);
  const high = readUint8(bytes, offset + 1);

  if (low === undefined || high === undefined) {
    return undefined;
  }

  return low | (high << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number | undefined {
  const low = readUint8(bytes, offset);
  const middle = readUint8(bytes, offset + 1);
  const high = readUint8(bytes, offset + 2);

  if (low === undefined || middle === undefined || high === undefined) {
    return undefined;
  }

  return low | (middle << 8) | (high << 16);
}

function readSint16LE(bytes: Uint8Array, offset: number): number | undefined {
  const value = readUint16LE(bytes, offset);

  if (value === undefined) {
    return undefined;
  }

  return value >= 32768 ? value - 65536 : value;
}

const FTMS_MORE_DATA_FLAG = 0x0001;
const FTMS_AVERAGE_SPEED_FLAG = 0x0002;
const FTMS_CADENCE_FLAG = 0x0004;
const FTMS_AVERAGE_CADENCE_FLAG = 0x0008;
const FTMS_DISTANCE_FLAG = 0x0010;
const FTMS_RESISTANCE_FLAG = 0x0020;
const FTMS_POWER_FLAG = 0x0040;
const FTMS_HEART_RATE_FLAG = 0x0200;

interface FtmsCursor {
  bytes: Uint8Array;
  offset: number;
}

type FtmsReader<T extends number> = (bytes: Uint8Array, offset: number) => T | undefined;

function skipField(cursor: FtmsCursor, shouldSkip: boolean, size: number): void {
  if (shouldSkip) {
    cursor.offset += size;
  }
}

function readOptionalField<T extends number>(
  cursor: FtmsCursor,
  shouldRead: boolean,
  size: number,
  reader: FtmsReader<T>,
  transform?: (value: T) => number,
): number | undefined {
  if (!shouldRead) {
    return undefined;
  }

  const value = reader(cursor.bytes, cursor.offset);
  if (value === undefined) {
    return undefined;
  }

  cursor.offset += size;
  return transform ? transform(value) : value;
}

function buildBikeMetrics(
  speed: number | undefined,
  cadence: number | undefined,
  power: number | undefined,
  distance: number | undefined,
  resistance: number | undefined,
  heartRate: number | undefined,
): Partial<BikeMetrics> {
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
  const flags = readUint16LE(bytes, 0);
  if (flags === undefined) {
    return {};
  }

  const cursor: FtmsCursor = { bytes, offset: 2 };

  const speed = readOptionalField(cursor, (flags & FTMS_MORE_DATA_FLAG) === 0, 2, readUint16LE, (value) => value / 100);

  skipField(cursor, (flags & FTMS_AVERAGE_SPEED_FLAG) !== 0, 2);

  const cadence = readOptionalField(cursor, (flags & FTMS_CADENCE_FLAG) !== 0, 2, readUint16LE, (value) => value / 2);

  skipField(cursor, (flags & FTMS_AVERAGE_CADENCE_FLAG) !== 0, 2);

  const distance = readOptionalField(cursor, (flags & FTMS_DISTANCE_FLAG) !== 0, 3, readUint24LE);

  const resistance = readOptionalField(cursor, (flags & FTMS_RESISTANCE_FLAG) !== 0, 2, readSint16LE);

  const power = readOptionalField(cursor, (flags & FTMS_POWER_FLAG) !== 0, 2, readSint16LE);

  const heartRate = readOptionalField(cursor, (flags & FTMS_HEART_RATE_FLAG) !== 0, 1, readUint8);

  // Energy is present if Bit 10 is 1 (UINT16 x 5)
  // Elapsed Time is present if Bit 11 is 1 (UINT16)

  return buildBikeMetrics(speed, cadence, power, distance, resistance, heartRate);
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
  const opCode = readUint8(bytes, 0);
  if (opCode === undefined) {
    return undefined;
  }

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
