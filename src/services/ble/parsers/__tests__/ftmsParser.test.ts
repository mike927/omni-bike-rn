import { BikeStatus } from '../../BikeAdapter';
import { parseFtmsIndoorBikeData, parseFtmsMachineStatus } from '../ftmsParser';

// Helpers to build FTMS Indoor Bike Data payloads
function buildPayload(flags: number, ...fieldBytes: number[]): Uint8Array {
  return new Uint8Array([flags & 0xff, (flags >> 8) & 0xff, ...fieldBytes]);
}

describe('parseFtmsIndoorBikeData', () => {
  it('returns empty object for payloads shorter than 2 bytes', () => {
    expect(parseFtmsIndoorBikeData(new Uint8Array([]))).toEqual({});
    expect(parseFtmsIndoorBikeData(new Uint8Array([0x00]))).toEqual({});
  });

  it('parses instantaneous speed when More Data bit (0) is 0', () => {
    // flags = 0x0000 (bit 0 = 0 → speed present), speed = 2500 → 25.00 km/h
    const payload = buildPayload(0x0000, 0xc4, 0x09);
    expect(parseFtmsIndoorBikeData(payload).speed).toBeCloseTo(25.0);
  });

  it('omits speed when More Data bit (0) is 1', () => {
    const payload = buildPayload(0x0001, 0xc4, 0x09);
    expect(parseFtmsIndoorBikeData(payload).speed).toBeUndefined();
  });

  it('parses instantaneous cadence when bit 2 is set', () => {
    // flags = 0x0004 (bit 0 = 0 → speed, bit 2 → cadence), speed = 0, cadence = 160 → 80 rpm
    const payload = buildPayload(0x0004, 0x00, 0x00, 0xa0, 0x00);
    const result = parseFtmsIndoorBikeData(payload);
    expect(result.cadence).toBe(80);
  });

  it('parses 24-bit total distance when bit 4 is set', () => {
    // flags = 0x0011 (bit 0 = 1 → no speed, bit 4 → distance), distance = 1234 m
    const payload = buildPayload(0x0011, 0xd2, 0x04, 0x00);
    expect(parseFtmsIndoorBikeData(payload).distance).toBe(1234);
  });

  it('parses negative signed resistance (SINT16) when bit 5 is set', () => {
    // flags = 0x0021 (bit 0 = 1, bit 5 → resistance), resistance = -1 (0xFFFF)
    const payload = buildPayload(0x0021, 0xff, 0xff);
    expect(parseFtmsIndoorBikeData(payload).resistance).toBe(-1);
  });

  it('parses negative signed power (SINT16) when bit 6 is set', () => {
    // flags = 0x0041 (bit 0 = 1, bit 6 → power), power = -10 (0xFFF6)
    const payload = buildPayload(0x0041, 0xf6, 0xff);
    expect(parseFtmsIndoorBikeData(payload).power).toBe(-10);
  });

  it('parses heart rate (UINT8) when bit 9 is set', () => {
    // flags = 0x0201 (bit 0 = 1, bit 9 → HR), HR = 142
    const payload = buildPayload(0x0201, 0x8e);
    expect(parseFtmsIndoorBikeData(payload).heartRate).toBe(142);
  });

  it('parses the full FTMS energy block when bit 10 is set', () => {
    const payload = buildPayload(0x0101, 0x2a, 0x00, 0x58, 0x02, 0x0a);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({
      totalEnergyKcal: 42,
      energyPerHourKcal: 600,
      energyPerMinuteKcal: 10,
    });
  });

  it('parses a small bike calorie total without inflating it via byte order', () => {
    const payload = buildPayload(0x0101, 0x05, 0x00, 0x00, 0x00, 0x00);
    expect(parseFtmsIndoorBikeData(payload).totalEnergyKcal).toBe(5);
  });

  it('parses energy correctly when average power is also present before it', () => {
    const payload = buildPayload(0x01c4, 0x2c, 0x01, 0x90, 0x00, 0x04, 0x00, 0x08, 0x00, 0xb4, 0x00, 0x02, 0x00, 0x2a);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({
      speed: 3,
      cadence: 72,
      power: 4,
      totalEnergyKcal: 180,
      energyPerHourKcal: 2,
      energyPerMinuteKcal: 42,
    });
  });

  it('ignores truncated speed bytes', () => {
    const payload = buildPayload(0x0000, 0xc4);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({});
  });

  it('keeps parsed speed when cadence bytes are truncated', () => {
    const payload = buildPayload(0x0004, 0xc4, 0x09, 0xa0);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({ speed: 25 });
  });

  it('keeps parsed speed when distance bytes are truncated', () => {
    const payload = buildPayload(0x0010, 0xc4, 0x09, 0xd2, 0x04);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({ speed: 25 });
  });

  it('keeps parsed speed when resistance bytes are truncated', () => {
    const payload = buildPayload(0x0020, 0xc4, 0x09, 0xff);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({ speed: 25 });
  });

  it('keeps parsed speed when power bytes are truncated', () => {
    const payload = buildPayload(0x0040, 0xc4, 0x09, 0xf6);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({ speed: 25 });
  });

  it('keeps parsed speed when average power bytes are truncated', () => {
    const payload = buildPayload(0x00c0, 0xc4, 0x09, 0xf6, 0xff, 0x01);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({ speed: 25, power: -10 });
  });

  it('keeps parsed speed when heart rate byte is truncated', () => {
    const payload = buildPayload(0x0200, 0xc4, 0x09);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({ speed: 25 });
  });

  it('keeps parsed speed when energy bytes are truncated', () => {
    const payload = buildPayload(0x0100, 0xc4, 0x09, 0x2a, 0x00, 0x58, 0x02);
    expect(parseFtmsIndoorBikeData(payload)).toEqual({ speed: 25 });
  });

  it('parses a full Zipro-style packet with average power and energy fields', () => {
    const payload = buildPayload(
      0x1ffe,
      0x82,
      0x0a,
      0xce,
      0x09,
      0x90,
      0x00,
      0x86,
      0x00,
      0x76,
      0x00,
      0x00,
      0x01,
      0x00,
      0x2a,
      0x00,
      0x26,
      0x00,
      0x01,
      0x00,
      0xae,
      0x01,
      0x07,
      0x00,
      0x39,
      0x10,
      0x00,
      0x00,
      0x00,
    );

    expect(parseFtmsIndoorBikeData(payload)).toEqual(
      expect.objectContaining({
        speed: 26.9,
        cadence: 72,
        distance: 118,
        resistance: 1,
        power: 42,
        heartRate: 0,
        totalEnergyKcal: 1,
        energyPerHourKcal: 430,
        energyPerMinuteKcal: 7,
      }),
    );
  });
});

describe('parseFtmsMachineStatus', () => {
  it('maps reset and stopped op codes to a stopped bike status', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([0x01]))).toBe(BikeStatus.Stopped);
    expect(parseFtmsMachineStatus(new Uint8Array([0x02]))).toBe(BikeStatus.Stopped);
  });

  it('maps the Zipro start/resume op code to a started bike status', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([0x04]))).toBe(BikeStatus.Started);
  });

  it('ignores non-state machine status op codes', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([0x07]))).toBeUndefined();
    expect(parseFtmsMachineStatus(new Uint8Array([0x08]))).toBeUndefined();
    expect(parseFtmsMachineStatus(new Uint8Array([0x0a]))).toBeUndefined();
  });

  it('returns undefined for empty payloads', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([]))).toBeUndefined();
  });
});
