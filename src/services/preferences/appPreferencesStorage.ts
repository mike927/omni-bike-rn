import Storage from 'expo-sqlite/kv-store';

import type { HrSource } from '../hr/hrSource';

const STORAGE_KEY = 'omni:appPreferences';

interface AppPreferences {
  onboardingCompleted: boolean;
  /** The user's chosen primary HR source. Absent = no explicit preference set. */
  primaryHrSource?: HrSource;
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

export async function loadPrimaryHrSource(): Promise<HrSource | null> {
  const prefs = await loadAppPreferences();
  return prefs.primaryHrSource ?? null;
}

export async function setPrimaryHrSource(source: HrSource): Promise<void> {
  const current = await loadAppPreferences();
  await Storage.setItem(STORAGE_KEY, JSON.stringify({ ...current, primaryHrSource: source }));
}
