import type { PersistedTrainingSession, PersistedTrainingSample } from '../../../types/sessionPersistence';

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function resolveDistanceMeters(
  sample: PersistedTrainingSample,
  totalDistanceMeters: number,
  totalElapsedSeconds: number,
): number {
  if (sample.metrics.distance !== null) {
    return sample.metrics.distance;
  }
  if (totalElapsedSeconds <= 0) {
    return 0;
  }
  return (sample.elapsedSeconds / totalElapsedSeconds) * totalDistanceMeters;
}

function buildTrackpoint(sample: PersistedTrainingSample, distanceMeters: number): string {
  const hrSection =
    sample.metrics.heartRate === null
      ? ''
      : `
        <HeartRateBpm>
          <Value>${sample.metrics.heartRate}</Value>
        </HeartRateBpm>`;

  return `
      <Trackpoint>
        <Time>${escapeXml(msToIso(sample.recordedAtMs))}</Time>
        <DistanceMeters>${distanceMeters.toFixed(1)}</DistanceMeters>
        <Cadence>${Math.min(sample.metrics.cadence, 254)}</Cadence>${hrSection}
        <Extensions>
          <ns3:TPX>
            <ns3:Speed>${kmhToMs(sample.metrics.speed).toFixed(3)}</ns3:Speed>
            <ns3:Watts>${sample.metrics.power}</ns3:Watts>
          </ns3:TPX>
        </Extensions>
      </Trackpoint>`;
}

/**
 * Converts a persisted training session and its samples to a TCX XML string
 * suitable for upload to Strava or any other TCX-compatible provider.
 *
 * This is a provider-agnostic serializer. Place provider-specific upload logic
 * in the relevant ExportProvider implementation, not here.
 */
export function serializeSessionToTcx(session: PersistedTrainingSession, samples: PersistedTrainingSample[]): string {
  const startTime = escapeXml(msToIso(session.startedAtMs));
  const trackpoints = samples
    .map((sample) =>
      buildTrackpoint(sample, resolveDistanceMeters(sample, session.totalDistanceMeters, session.elapsedSeconds)),
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Biking"><!-- Strava ignores this attribute; activity_type is set via the multipart form field (VirtualRide) -->
      <Id>${startTime}</Id>
      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${session.elapsedSeconds}</TotalTimeSeconds>
        <DistanceMeters>${session.totalDistanceMeters.toFixed(1)}</DistanceMeters>
        <Calories>${Math.round(session.totalCaloriesKcal)}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}
