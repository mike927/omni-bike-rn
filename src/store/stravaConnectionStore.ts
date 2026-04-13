import { create } from 'zustand';

import { loadTokens } from '../services/strava/stravaTokenStorage';
import type { StravaAthlete } from '../services/strava/types';

export interface StravaConnectionStore {
  connected: boolean;
  athlete: StravaAthlete | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setConnected: (athlete: StravaAthlete) => void;
  setDisconnected: () => void;
}

export const useStravaConnectionStore = create<StravaConnectionStore>((set, get) => ({
  connected: false,
  athlete: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const tokens = await loadTokens();
    set({ connected: tokens !== null, athlete: tokens?.athlete ?? null, hydrated: true });
  },

  setConnected: (athlete) => set({ connected: true, athlete }),
  setDisconnected: () => set({ connected: false, athlete: null }),
}));
