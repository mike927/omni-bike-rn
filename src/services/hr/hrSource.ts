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
