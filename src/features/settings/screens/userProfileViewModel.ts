import { deriveAgeYears, toKeytelInputs, toMifflinInputs, type UserProfile } from '../../../types/userProfile';

export type AccuracyTone = 'good' | 'working' | 'inactive';

export interface ProfileStat {
  readonly key: 'sex' | 'age' | 'weight' | 'height';
  readonly label: string;
  readonly value: string;
  readonly unit: string | null;
}

export interface ProfileAccuracy {
  readonly label: string;
  readonly tone: AccuracyTone;
  readonly caption: string;
}

export interface ProfileViewModel {
  readonly stats: readonly ProfileStat[];
  readonly accuracy: ProfileAccuracy;
}

const SEX_LABEL: Record<'male' | 'female', string> = { male: 'Male', female: 'Female' };
const DASH = '—';

export function deriveProfileView(profile: UserProfile, nowMs: number): ProfileViewModel {
  const ageYears = profile.dateOfBirth ? deriveAgeYears(profile.dateOfBirth, nowMs) : null;

  const stats: ProfileStat[] = [
    { key: 'sex', label: 'SEX', value: profile.sex ? SEX_LABEL[profile.sex] : DASH, unit: null },
    {
      key: 'age',
      label: 'AGE',
      value: ageYears === null ? DASH : String(Math.floor(ageYears)),
      unit: ageYears === null ? null : 'yrs',
    },
    {
      key: 'weight',
      label: 'WEIGHT',
      value: profile.weightKg === null ? DASH : String(profile.weightKg),
      unit: profile.weightKg === null ? null : 'kg',
    },
    {
      key: 'height',
      label: 'HEIGHT',
      value: profile.heightCm === null ? DASH : String(profile.heightCm),
      unit: profile.heightCm === null ? null : 'cm',
    },
  ];

  const keytel = toKeytelInputs(profile, nowMs);
  const mifflin = toMifflinInputs(profile, nowMs);

  const accuracy: ProfileAccuracy =
    keytel && mifflin
      ? { label: 'Best', tone: 'good', caption: 'Heart-rate calorie estimation enabled' }
      : keytel
        ? { label: 'Good', tone: 'working', caption: 'Add height for resting-calorie accuracy' }
        : { label: 'Set up', tone: 'inactive', caption: 'Add sex, birth date & weight for HR calories' };

  return { stats, accuracy };
}
