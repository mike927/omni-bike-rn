import Storage from 'expo-sqlite/kv-store';

const STORAGE_KEY = 'omni:appPreferences';

interface AppPreferences {
  onboardingCompleted: boolean;
  /** Whether the user has enabled Apple Watch as a native HR source. */
  watchHrEnabled: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  onboardingCompleted: false,
  watchHrEnabled: false,
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

export async function loadWatchHrEnabled(): Promise<boolean> {
  const prefs = await loadAppPreferences();
  return prefs.watchHrEnabled;
}

export async function setWatchHrEnabled(enabled: boolean): Promise<void> {
  const current = await loadAppPreferences();
  await Storage.setItem(STORAGE_KEY, JSON.stringify({ ...current, watchHrEnabled: enabled }));
}
