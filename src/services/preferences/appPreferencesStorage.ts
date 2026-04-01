import Storage from 'expo-sqlite/kv-store';

const STORAGE_KEY = 'omni:appPreferences';

interface AppPreferences {
  onboardingCompleted: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  onboardingCompleted: false,
};

export async function loadAppPreferences(): Promise<AppPreferences> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return JSON.parse(raw) as AppPreferences;
  } catch (err: unknown) {
    console.error('[appPreferencesStorage] Failed to load app preferences:', err);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  const current = await loadAppPreferences();
  await Storage.setItem(STORAGE_KEY, JSON.stringify({ ...current, onboardingCompleted: true }));
}
