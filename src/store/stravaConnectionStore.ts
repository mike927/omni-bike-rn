import { create } from 'zustand';

import { getConnectedAthlete, isStravaConnected } from '../services/strava/stravaAuthService';
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
    const connected = await isStravaConnected();
    const athlete = connected ? await getConnectedAthlete() : null;
    set({ connected, athlete, hydrated: true });
  },

  setConnected: (athlete) => set({ connected: true, athlete }),
  setDisconnected: () => set({ connected: false, athlete: null }),
}));
