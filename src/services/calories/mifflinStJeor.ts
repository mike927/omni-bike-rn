import type { MifflinInputs } from '../../types/userProfile';

const SECONDS_PER_DAY = 86400;

export function bmrKcalPerDay({ sex, weightKg, heightCm, ageYears }: MifflinInputs): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return base + (sex === 'male' ? 5 : -161);
}

export function basalKcalForWindow(inputs: MifflinInputs, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return (bmrKcalPerDay(inputs) * durationSeconds) / SECONDS_PER_DAY;
}
