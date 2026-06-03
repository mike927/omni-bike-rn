import { create } from 'zustand';

import { loadPrimaryHrSource, setPrimaryHrSource } from '../services/preferences/appPreferencesStorage';
import type { HrSource } from '../services/hr/hrSource';

interface HrSourceStore {
  primary: HrSource | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setPrimary: (source: HrSource) => Promise<void>;
}

export const useHrSourceStore = create<HrSourceStore>((set, get) => ({
  primary: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const primary = await loadPrimaryHrSource();
    set({ primary, hydrated: true });
  },

  setPrimary: async (source: HrSource) => {
    set({ primary: source });
    await setPrimaryHrSource(source);
  },
}));
