export type HrSource = 'watch' | 'bluetooth' | 'bike';

export interface HrSourceAvailabilityInput {
  readonly watchSupported: boolean;
  readonly savedHrStrapName: string | null;
}

const PRIORITY: readonly HrSource[] = ['watch', 'bluetooth', 'bike'];

export function availableHrSources({ watchSupported, savedHrStrapName }: HrSourceAvailabilityInput): HrSource[] {
  const out: HrSource[] = [];
  if (watchSupported) out.push('watch');
  if (savedHrStrapName !== null) out.push('bluetooth');
  out.push('bike'); // the bike's built-in pulse sensor is always a candidate
  return out;
}

export function resolveDefaultPrimary(available: HrSource[]): HrSource {
  return PRIORITY.find((s) => available.includes(s)) ?? 'bike';
}

// Sustained loss before "No signal". Set above the slowest source cadence (Apple
// Watch wrist HR delivers ~every 6 s with occasional longer gaps) so a normal gap
// does not blank the value; only a real loss does.
export const HR_NO_SIGNAL_TIMEOUT_MS = 15_000;

export interface HrReadingInput {
  readonly activeSource: HrSource;
  readonly latestAppleWatchHr: number | null;
  readonly lastAppleWatchSampleAtMs: number | null;
  readonly latestBluetoothHr: number | null;
  readonly lastBluetoothHrSampleAtMs: number | null;
  readonly bikeHeartRate: number | null;
  readonly nowMs: number;
}
export interface HrReading {
  readonly source: HrSource;
  readonly bpm: number | null; // null = no signal
  readonly live: boolean;
}

function fresh(value: number | null, atMs: number | null, nowMs: number): number | null {
  if (value === null || atMs === null) return null;
  return nowMs - atMs <= HR_NO_SIGNAL_TIMEOUT_MS ? value : null;
}

export function resolveHrReading(input: HrReadingInput): HrReading {
  let bpm: number | null;
  switch (input.activeSource) {
    case 'watch':
      bpm = fresh(input.latestAppleWatchHr, input.lastAppleWatchSampleAtMs, input.nowMs);
      break;
    case 'bluetooth':
      bpm = fresh(input.latestBluetoothHr, input.lastBluetoothHrSampleAtMs, input.nowMs);
      break;
    case 'bike':
      bpm = input.bikeHeartRate; // FTMS pushes ~1 Hz while connected; absence = no signal
      break;
  }
  return { source: input.activeSource, bpm, live: bpm !== null };
}
