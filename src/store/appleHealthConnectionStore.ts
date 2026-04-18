import { create } from 'zustand';

import { loadAppleHealthConnected, setAppleHealthConnected } from '../services/health/appleHealthConnectionStorage';

export interface AppleHealthConnectionStore {
  connected: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setConnected: () => Promise<void>;
  setDisconnected: () => Promise<void>;
}

export const useAppleHealthConnectionStore = create<AppleHealthConnectionStore>((set, get) => ({
  connected: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const connected = await loadAppleHealthConnected();
    set({ connected, hydrated: true });
  },

  setConnected: async () => {
    await setAppleHealthConnected(true);
    set({ connected: true });
  },

  setDisconnected: async () => {
    await setAppleHealthConnected(false);
    set({ connected: false });
  },
}));
