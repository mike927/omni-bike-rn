import { Buffer } from 'buffer';
import type { Device } from 'react-native-ble-plx';

import { extractCompanyId, isLikelyHrCandidate, WEARABLE_VENDOR_COMPANY_IDS } from '../scanFilters';
import { HR_SERVICE_UUID, HR_SERVICE_UUID_SHORT } from '../bleUuids';

/**
 * Build a base64-encoded manufacturer-data blob whose first two bytes encode
 * the given Bluetooth SIG Company Identifier as little-endian, matching the
 * on-the-wire layout delivered by `react-native-ble-plx`.
 */
function manufacturerDataWithCompanyId(companyId: number, payload: number[] = []): string {
  const lo = companyId & 0xff;
  const hi = (companyId >> 8) & 0xff;
  return Buffer.from([lo, hi, ...payload]).toString('base64');
}

/**
 * Build a fake `Device` that exposes only the advertisement fields
 * `isLikelyHrCandidate` actually reads. Cast via `unknown` because the real
 * `Device` class has ~30 runtime-only methods we never touch.
 */
function makeDevice(partial: { serviceUUIDs?: string[] | null; manufacturerData?: string | null }): Device {
  return {
    id: 'fake-id',
    name: 'Fake Device',
    serviceUUIDs: partial.serviceUUIDs ?? null,
    manufacturerData: partial.manufacturerData ?? null,
  } as unknown as Device;
}

describe('extractCompanyId', () => {
  it('returns null for empty or null manufacturer data', () => {
    expect(extractCompanyId(null)).toBeNull();
    expect(extractCompanyId(undefined)).toBeNull();
    expect(extractCompanyId('')).toBeNull();
  });

  it('returns null when the decoded blob is shorter than 2 bytes', () => {
    const oneByte = Buffer.from([0x87]).toString('base64');
    expect(extractCompanyId(oneByte)).toBeNull();
  });

  it('decodes the Garmin Company ID (0x0087) from little-endian bytes', () => {
    expect(extractCompanyId(manufacturerDataWithCompanyId(0x0087))).toBe(0x0087);
  });

  it('decodes the Polar Company ID (0x006B)', () => {
    expect(extractCompanyId(manufacturerDataWithCompanyId(0x006b))).toBe(0x006b);
  });

  it('ignores bytes beyond the company id', () => {
    expect(extractCompanyId(manufacturerDataWithCompanyId(0x0087, [0x01, 0x02, 0x03, 0xff]))).toBe(0x0087);
  });
});

describe('isLikelyHrCandidate', () => {
  describe('accepts real HR devices', () => {
    it('accepts a chest strap that advertises the standard HR service', () => {
      const device = makeDevice({ serviceUUIDs: [HR_SERVICE_UUID] });
      expect(isLikelyHrCandidate(device)).toBe(true);
    });

    it('accepts a chest strap that advertises the short-form HR service UUID', () => {
      const device = makeDevice({ serviceUUIDs: [HR_SERVICE_UUID_SHORT] });
      expect(isLikelyHrCandidate(device)).toBe(true);
    });

    it('accepts a Garmin watch in HR Broadcast mode via the Garmin Company ID in manufacturer data', () => {
      // Broadcast-capable watches that do not advertise 0x180D in the ad
      // packet must still surface via the wearable vendor allowlist. Garmin
      // populates manufacturer data with Company ID 0x0087.
      const device = makeDevice({
        serviceUUIDs: null,
        manufacturerData: manufacturerDataWithCompanyId(0x0087),
      });
      expect(isLikelyHrCandidate(device)).toBe(true);
    });

    it('accepts a Garmin-branded device with a non-HR service UUID via vendor allowlist', () => {
      // Defensive positive match: if a future Garmin firmware adds a proprietary
      // 128-bit service to the advertisement, we still recognise the vendor.
      const device = makeDevice({
        serviceUUIDs: ['a5c01000-0000-1000-8000-00805f9b34fb'],
        manufacturerData: manufacturerDataWithCompanyId(0x0087),
      });
      expect(isLikelyHrCandidate(device)).toBe(true);
    });

    it('accepts a Polar-branded device with a non-HR service UUID via vendor allowlist', () => {
      const device = makeDevice({
        serviceUUIDs: ['fb005c80-02e7-f387-1cad-8acd2d8df0c8'],
        manufacturerData: manufacturerDataWithCompanyId(0x006b),
      });
      expect(isLikelyHrCandidate(device)).toBe(true);
    });
  });

  describe('rejects obvious non-HR devices', () => {
    it('rejects a MacBook advertising Apple Continuity services', () => {
      const device = makeDevice({
        serviceUUIDs: ['0000fef3-0000-1000-8000-00805f9b34fb'],
        manufacturerData: manufacturerDataWithCompanyId(0x004c), // Apple
      });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });

    it('rejects a Samsung TV advertising AirPlay / Samsung services', () => {
      const device = makeDevice({
        serviceUUIDs: ['0000fd6f-0000-1000-8000-00805f9b34fb'],
        manufacturerData: manufacturerDataWithCompanyId(0x0075), // Samsung
      });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });

    it('rejects Sony WH-1000XM5 headphones advertising audio profiles', () => {
      const device = makeDevice({
        serviceUUIDs: ['0000110b-0000-1000-8000-00805f9b34fb'],
        manufacturerData: manufacturerDataWithCompanyId(0x012d), // Sony
      });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });

    it('rejects an iPhone advertising Handoff services without wearable vendor id', () => {
      const device = makeDevice({
        serviceUUIDs: ['0000fed2-0000-1000-8000-00805f9b34fb'],
        manufacturerData: manufacturerDataWithCompanyId(0x004c),
      });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });

    // The following four cases mirror the real advertisement shapes captured
    // on the author's hardware during diagnosis. They used to be *accepted*
    // by the earlier "empty-ad → accept" rule and are the reason that rule
    // was removed. See scanFilters.ts for the full rationale.
    it('rejects a MacBook advertising with null serviceUUIDs and null manufacturer data', () => {
      const device = makeDevice({ serviceUUIDs: null, manufacturerData: null });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });

    it('rejects a Samsung TV advertising with null serviceUUIDs but Samsung manufacturer data', () => {
      const device = makeDevice({
        serviceUUIDs: null,
        manufacturerData: manufacturerDataWithCompanyId(0x0075),
      });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });

    it('rejects an Apple Watch advertising with null serviceUUIDs and null manufacturer data', () => {
      const device = makeDevice({ serviceUUIDs: null, manufacturerData: null });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });

    it('rejects a device whose advertisement is an empty service-UUID array', () => {
      const device = makeDevice({ serviceUUIDs: [] });
      expect(isLikelyHrCandidate(device)).toBe(false);
    });
  });

  describe('wearable vendor allowlist', () => {
    it('contains all core supported families', () => {
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x0087)).toBe(true); // Garmin
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x006b)).toBe(true); // Polar
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x0157)).toBe(true); // Amazfit / Zepp
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x01e7)).toBe(true); // Suunto
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x0553)).toBe(true); // COROS
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x0067)).toBe(true); // Wahoo
    });

    it('does not contain phone / TV / headphone vendors', () => {
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x004c)).toBe(false); // Apple
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x0075)).toBe(false); // Samsung
      expect(WEARABLE_VENDOR_COMPANY_IDS.has(0x012d)).toBe(false); // Sony
    });
  });
});
