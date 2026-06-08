import Storage from 'expo-sqlite/kv-store';

import { isHrSource, type HrSource } from '../hr/hrSource';

const STORAGE_KEY = 'omni:appPreferences';

interface AppPreferences {
  onboardingCompleted: boolean;
  /**
   * The user's chosen primary HR source. Absent = no explicit preference set.
   * Stored as a string so a value later removed from `HrSource` (e.g. the legacy
   * 'bike') round-trips through JSON without a type lie; {@link loadPrimaryHrSource}
   * validates it on read.
   */
  primaryHrSource?: string;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  onboardingCompleted: false,
};

export async function loadAppPreferences(): Promise<AppPreferences> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<AppPreferences>) };
  } catch (err: unknown) {
    console.error('[appPreferencesStorage] Failed to load app preferences:', err);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  const current = await loadAppPreferences();
  await Storage.setItem(STORAGE_KEY, JSON.stringify({ ...current, onboardingCompleted: true }));
}

// Note: this replaces the legacy `watchHrEnabled` boolean. A pre-existing user's
// `watchHrEnabled` value is intentionally NOT migrated — `primaryHrSource` starts
// absent and is resolved to the default (watch > bluetooth) until the user picks
// one in Settings. A user who had explicitly disabled watch HR is reset to that
// default; this is a one-time, non-destructive reset.
//
// The stored value is validated through `isHrSource`, so a removed member (the
// legacy 'bike') — or any unrecognized string — resolves to null (no explicit
// preference), falling through to the availability default rather than leaking an
// invalid source.
export async function loadPrimaryHrSource(): Promise<HrSource | null> {
  const prefs = await loadAppPreferences();
  return isHrSource(prefs.primaryHrSource) ? prefs.primaryHrSource : null;
}

export async function setPrimaryHrSource(source: HrSource): Promise<void> {
  const current = await loadAppPreferences();
  await Storage.setItem(STORAGE_KEY, JSON.stringify({ ...current, primaryHrSource: source }));
}
