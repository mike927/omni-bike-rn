import type { ProviderGearSummary } from '../../../types/providerGear';

/** Single source of truth for a provider bike's meta line (matches the legacy inline logic). */
export function providerBikeMetaLabel(gear: Pick<ProviderGearSummary, 'isPrimary'>, isPotentialMatch: boolean): string {
  if (isPotentialMatch && gear.isPrimary) return 'Possible match · Primary bike in provider account';
  if (isPotentialMatch) return 'Possible match';
  if (gear.isPrimary) return 'Primary bike in provider account';
  return 'Provider bike';
}
