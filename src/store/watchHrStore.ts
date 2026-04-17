import { create } from 'zustand';

import { loadWatchHrEnabled, setWatchHrEnabled } from '../services/preferences/appPreferencesStorage';

interface WatchHrStore {
  enabled: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

export const useWatchHrStore = create<WatchHrStore>((set, get) => ({
  enabled: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const enabled = await loadWatchHrEnabled();
    set({ enabled, hydrated: true });
  },

  setEnabled: async (enabled: boolean) => {
    await setWatchHrEnabled(enabled);
    set({ enabled });
  },
}));
