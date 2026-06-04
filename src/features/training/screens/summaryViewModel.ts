import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../types/sessionPersistence';
import { formatCompactDuration, formatHistoryDate } from '../../../ui/formatters';

export interface SummaryHero {
  readonly distance: string;
  readonly distanceUnit: string;
  readonly dateLabel: string;
  readonly movingLabel: string;
  readonly caloriesLabel: string;
}

export type EffortAccent = 'power' | 'hr' | null;

export interface EffortStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly peakLabel: string | null;
  readonly accent: EffortAccent;
}

export interface SummaryViewModel {
  readonly hero: SummaryHero;
  readonly effort: readonly EffortStat[];
  readonly powerTrend: readonly number[];
  readonly gearLabel: string | null;
}

export interface SummaryViewInput {
  readonly session: PersistedTrainingSession;
  readonly samples: readonly PersistedTrainingSample[];
}

const POWER_TREND_BUCKETS = 12;

function meanOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function maxOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, v) => (v > acc ? v : acc), -Infinity);
}

/** Reduce a full-ride power series to at most `buckets` averaged points. */
export function downsamplePower(powers: readonly number[], buckets = POWER_TREND_BUCKETS): number[] {
  if (powers.length === 0) return [];
  if (powers.length <= buckets) return [...powers];
  const size = powers.length / buckets;
  const out: number[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const slice = powers.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    out.push(Math.round(meanOf(slice) ?? 0));
  }
  return out;
}

const round0 = (n: number): string => String(Math.round(n));
const round1 = (n: number): string => n.toFixed(1);

function effortStat(
  key: string,
  label: string,
  unit: string,
  values: readonly number[],
  format: (n: number) => string,
  accent: EffortAccent,
  fallback: number | null,
): EffortStat {
  const avg = meanOf(values);
  if (avg === null) {
    return { key, label, unit, accent, value: fallback === null ? '--' : format(fallback), peakLabel: null };
  }
  const peak = maxOf(values);
  return {
    key,
    label,
    unit,
    accent,
    value: format(avg),
    peakLabel: peak === null ? null : `${format(peak)} ${unit}`,
  };
}

function buildGearLabel(session: PersistedTrainingSession): string | null {
  const parts = [session.savedBikeSnapshot?.name, session.savedHrSnapshot?.name].filter(
    (n): n is string => typeof n === 'string' && n.length > 0,
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

export function deriveSummaryView({ session, samples }: SummaryViewInput): SummaryViewModel {
  const metrics = samples.map((s) => s.metrics);
  const powers = metrics.map((m) => m.power);
  const speeds = metrics.map((m) => m.speed);
  const cadences = metrics.map((m) => m.cadence);
  const heartRates = metrics.map((m) => m.heartRate).filter((hr): hr is number => hr !== null);

  // The final-snapshot fallback only applies when no per-second samples were persisted
  // at all (e.g. a very short or legacy ride). When samples exist we trust them — so a
  // ride that recorded data but never had a heart-rate source shows "--", not a stale
  // final reading.
  const final = samples.length === 0 ? session.currentMetrics : null;

  return {
    hero: {
      distance: (session.totalDistanceMeters / 1000).toFixed(1),
      distanceUnit: 'km',
      dateLabel: formatHistoryDate(session.startedAtMs),
      movingLabel: formatCompactDuration(session.elapsedSeconds),
      caloriesLabel: `${Math.round(session.totalCaloriesKcal)} kcal`,
    },
    effort: [
      effortStat('power', 'AVG POWER', 'W', powers, round0, 'power', final?.power ?? null),
      effortStat('hr', 'AVG HR', 'bpm', heartRates, round0, 'hr', final?.heartRate ?? null),
      effortStat('speed', 'AVG SPEED', 'km/h', speeds, round1, null, final?.speed ?? null),
      effortStat('cadence', 'AVG CADENCE', 'rpm', cadences, round0, null, final?.cadence ?? null),
    ],
    powerTrend: downsamplePower(powers),
    gearLabel: buildGearLabel(session),
  };
}
