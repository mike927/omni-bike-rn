import type { BiologicalSex } from '../../types/userProfile';

export interface KeytelTickInputs {
  sex: BiologicalSex;
  heartRateBpm: number;
  ageYears: number;
  weightKg: number;
}

const KJ_PER_KCAL = 4.184;
const SECONDS_PER_MINUTE = 60;

export function kcalPerMinute({ sex, heartRateBpm, ageYears, weightKg }: KeytelTickInputs): number {
  const kj =
    sex === 'male'
      ? -55.0969 + 0.6309 * heartRateBpm + 0.1988 * weightKg + 0.2017 * ageYears
      : -20.4022 + 0.4472 * heartRateBpm - 0.1263 * weightKg + 0.074 * ageYears;
  const kcal = kj / KJ_PER_KCAL;
  return Math.max(0, kcal);
}

export function kcalPerSecond(inputs: KeytelTickInputs): number {
  return kcalPerMinute(inputs) / SECONDS_PER_MINUTE;
}
