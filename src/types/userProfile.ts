/**
 * User profile types for personalized calorie calculation.
 *
 * Profile is auto-filled from Apple Health when connected (authoritative),
 * seeded from Strava (weight + sex only) otherwise. Manual edits are tracked
 * per field via `sources` and survive subsequent auto-syncs.
 */

/** Biological sex used by Keytel and Mifflin–St Jeor formulas. */
export type BiologicalSex = 'male' | 'female';

/** Origin of a profile field's current value. */
export type ProfileFieldSource = 'apple-health' | 'strava' | 'manual';

/**
 * Explicit union of editable profile fields. Used everywhere per-field source
 * tracking, manual-override gating, and clearing logic apply. Do NOT derive
 * from `keyof UserProfile` — that would recursively include `sources` and
 * break the contract.
 */
export type UserProfileField = 'sex' | 'dateOfBirth' | 'weightKg' | 'heightCm';

/** Statically-typed value map per profile field. */
export interface UserProfileFieldValueMap {
  sex: BiologicalSex;
  /** ISO yyyy-mm-dd. */
  dateOfBirth: string;
  weightKg: number;
  heightCm: number;
}

export interface UserProfile {
  sex: BiologicalSex | null;
  /** ISO yyyy-mm-dd. */
  dateOfBirth: string | null;
  weightKg: number | null;
  heightCm: number | null;
  sources: Partial<Record<UserProfileField, ProfileFieldSource>>;
}

/** Required inputs for the Keytel HR-based calorie formula. */
export interface KeytelInputs {
  sex: BiologicalSex;
  ageYears: number;
  weightKg: number;
}

/** Required inputs for the Mifflin–St Jeor basal metabolic rate formula. */
export interface MifflinInputs {
  sex: BiologicalSex;
  ageYears: number;
  weightKg: number;
  heightCm: number;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function deriveAgeYears(dobIso: string, nowMs: number): number | null {
  const dobMs = Date.parse(dobIso);
  if (!Number.isFinite(dobMs)) return null;
  const ageMs = nowMs - dobMs;
  if (ageMs <= 0) return null;
  return ageMs / MS_PER_YEAR;
}

export function toKeytelInputs(profile: UserProfile, nowMs: number = Date.now()): KeytelInputs | null {
  const { sex, dateOfBirth, weightKg } = profile;
  if (sex === null || dateOfBirth === null || weightKg === null) return null;
  const ageYears = deriveAgeYears(dateOfBirth, nowMs);
  if (ageYears === null) return null;
  return { sex, ageYears, weightKg };
}

export function toMifflinInputs(profile: UserProfile, nowMs: number = Date.now()): MifflinInputs | null {
  const { sex, dateOfBirth, weightKg, heightCm } = profile;
  if (sex === null || dateOfBirth === null || weightKg === null || heightCm === null) return null;
  const ageYears = deriveAgeYears(dateOfBirth, nowMs);
  if (ageYears === null) return null;
  return { sex, ageYears, weightKg, heightCm };
}

export const EMPTY_USER_PROFILE: UserProfile = {
  sex: null,
  dateOfBirth: null,
  weightKg: null,
  heightCm: null,
  sources: {},
};
