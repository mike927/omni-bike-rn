import { serializeSessionToTcx } from '../tcxSerializer';
import type { PersistedTrainingSession, PersistedTrainingSample } from '../../../../types/sessionPersistence';

const BASE_SESSION: PersistedTrainingSession = {
  id: 'session-1',
  status: 'finished',
  startedAtMs: 1_700_000_000_000,
  endedAtMs: 1_700_003_600_000,
  elapsedSeconds: 3600,
  totalDistanceMeters: 18000,
  totalCaloriesKcal: 450.7,
  currentMetrics: { speed: 20, cadence: 80, power: 150, heartRate: 140, resistance: null, distance: null },
  savedBikeSnapshot: null,
  savedHrSnapshot: null,
  uploadState: null,
  createdAtMs: 1_700_000_000_000,
  updatedAtMs: 1_700_003_600_000,
};

function makeSample(overrides: Partial<PersistedTrainingSample> = {}): PersistedTrainingSample {
  return {
    id: 'sample-1',
    sessionId: 'session-1',
    sequence: 1,
    recordedAtMs: 1_700_000_001_000,
    elapsedSeconds: 1,
    metrics: { speed: 20, cadence: 80, power: 150, heartRate: 140, resistance: null, distance: null },
    ...overrides,
  };
}

describe('serializeSessionToTcx', () => {
  describe('XML structure', () => {
    it('produces a valid XML declaration and root element', () => {
      const xml = serializeSessionToTcx(BASE_SESSION, []);
      expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
      expect(xml).toContain('<TrainingCenterDatabase');
      expect(xml).toContain('</TrainingCenterDatabase>');
    });

    it('includes required TCX namespaces', () => {
      const xml = serializeSessionToTcx(BASE_SESSION, []);
      expect(xml).toContain('xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"');
      expect(xml).toContain('xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"');
    });

    it('sets Sport="Biking" on Activity element', () => {
      const xml = serializeSessionToTcx(BASE_SESSION, []);
      expect(xml).toContain('Sport="Biking"');
    });

    it('uses session startedAtMs as Activity Id and Lap StartTime', () => {
      const xml = serializeSessionToTcx(BASE_SESSION, []);
      const expectedIso = new Date(BASE_SESSION.startedAtMs).toISOString();
      expect(xml).toContain(`<Id>${expectedIso}</Id>`);
      expect(xml).toContain(`StartTime="${expectedIso}"`);
    });

    it('includes correct Lap totals', () => {
      const xml = serializeSessionToTcx(BASE_SESSION, []);
      expect(xml).toContain(`<TotalTimeSeconds>${BASE_SESSION.elapsedSeconds}</TotalTimeSeconds>`);
      expect(xml).toContain(`<DistanceMeters>${BASE_SESSION.totalDistanceMeters.toFixed(1)}</DistanceMeters>`);
      // calories must be rounded integer
      expect(xml).toContain(`<Calories>451</Calories>`);
    });

    it('produces a valid Track element with no trackpoints for empty samples', () => {
      const xml = serializeSessionToTcx(BASE_SESSION, []);
      expect(xml).toContain('<Track>');
      expect(xml).toContain('</Track>');
      expect(xml).not.toContain('<Trackpoint>');
    });
  });

  describe('trackpoints', () => {
    it('emits one Trackpoint per sample', () => {
      const samples = [
        makeSample({ sequence: 1 }),
        makeSample({ id: 'sample-2', sequence: 2, recordedAtMs: 1_700_000_002_000 }),
      ];
      const xml = serializeSessionToTcx(BASE_SESSION, samples);
      const count = (xml.match(/<Trackpoint>/g) ?? []).length;
      expect(count).toBe(2);
    });

    it('formats Time as ISO 8601', () => {
      const sample = makeSample({ recordedAtMs: 1_700_000_001_000 });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      const expectedIso = new Date(1_700_000_001_000).toISOString();
      expect(xml).toContain(`<Time>${expectedIso}</Time>`);
    });

    it('includes Cadence from sample metrics', () => {
      const sample = makeSample({ metrics: { ...makeSample().metrics, cadence: 95 } });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      expect(xml).toContain('<Cadence>95</Cadence>');
    });

    it('converts speed from km/h to m/s in Extensions', () => {
      // 36 km/h → 10.000 m/s
      const sample = makeSample({ metrics: { ...makeSample().metrics, speed: 36 } });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      expect(xml).toContain('<ns3:Speed>10.000</ns3:Speed>');
    });

    it('includes power Watts in Extensions', () => {
      const sample = makeSample({ metrics: { ...makeSample().metrics, power: 200 } });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      expect(xml).toContain('<ns3:Watts>200</ns3:Watts>');
    });

    it('includes HeartRateBpm when heartRate is non-null', () => {
      const sample = makeSample({ metrics: { ...makeSample().metrics, heartRate: 155 } });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      expect(xml).toContain('<HeartRateBpm>');
      expect(xml).toContain('<Value>155</Value>');
    });

    it('omits HeartRateBpm when heartRate is null', () => {
      const sample = makeSample({ metrics: { ...makeSample().metrics, heartRate: null } });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      expect(xml).not.toContain('<HeartRateBpm>');
    });
  });

  describe('distance resolution', () => {
    it('uses sample.metrics.distance directly when available', () => {
      const sample = makeSample({ elapsedSeconds: 1800, metrics: { ...makeSample().metrics, distance: 9000 } });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      expect(xml).toContain('<DistanceMeters>9000.0</DistanceMeters>');
    });

    it('interpolates distance from elapsed ratio when sample distance is null', () => {
      // 1800s elapsed of 3600s total, total 18000m → expected 9000m
      const sample = makeSample({ elapsedSeconds: 1800, metrics: { ...makeSample().metrics, distance: null } });
      const xml = serializeSessionToTcx(BASE_SESSION, [sample]);
      expect(xml).toContain('<DistanceMeters>9000.0</DistanceMeters>');
    });

    it('returns 0 distance when totalElapsedSeconds is 0', () => {
      const session: PersistedTrainingSession = { ...BASE_SESSION, elapsedSeconds: 0 };
      const sample = makeSample({ metrics: { ...makeSample().metrics, distance: null } });
      const xml = serializeSessionToTcx(session, [sample]);
      expect(xml).toContain('<DistanceMeters>0.0</DistanceMeters>');
    });
  });

  describe('calories rounding', () => {
    it('rounds calories down', () => {
      const session: PersistedTrainingSession = { ...BASE_SESSION, totalCaloriesKcal: 100.2 };
      const xml = serializeSessionToTcx(session, []);
      expect(xml).toContain('<Calories>100</Calories>');
    });

    it('rounds calories up', () => {
      const session: PersistedTrainingSession = { ...BASE_SESSION, totalCaloriesKcal: 100.8 };
      const xml = serializeSessionToTcx(session, []);
      expect(xml).toContain('<Calories>101</Calories>');
    });
  });

  describe('XML escaping', () => {
    it('escapes special characters in ISO timestamps (none expected, but no crash)', () => {
      // ISO dates don't contain special XML chars — verify no crash with large ms values
      const session: PersistedTrainingSession = { ...BASE_SESSION, startedAtMs: 2_000_000_000_000 };
      expect(() => serializeSessionToTcx(session, [])).not.toThrow();
    });
  });
});
