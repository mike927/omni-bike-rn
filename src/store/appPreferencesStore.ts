import { create } from 'zustand';

import { loadAppPreferences, markOnboardingCompleted } from '../services/preferences/appPreferencesStorage';

interface AppPreferencesStore {
  onboardingCompleted: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useAppPreferencesStore = create<AppPreferencesStore>((set, get) => ({
  onboardingCompleted: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const prefs = await loadAppPreferences();
    set({ onboardingCompleted: prefs.onboardingCompleted, hydrated: true });
  },

  completeOnboarding: async () => {
    await markOnboardingCompleted();
    set({ onboardingCompleted: true });
  },
}));
