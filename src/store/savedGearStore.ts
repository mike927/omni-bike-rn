import { create } from 'zustand';

import {
  loadSavedGear,
  saveBikeDevice,
  saveHrDevice,
  forgetBikeDevice,
  forgetHrDevice,
} from '../services/gear/gearStorage';
import type { SavedDevice, ReconnectState } from '../types/gear';

export interface SavedGearStore {
  savedBike: SavedDevice | null;
  savedHrSource: SavedDevice | null;
  hydrated: boolean;
  bikeReconnectState: ReconnectState;
  hrReconnectState: ReconnectState;

  hydrate: () => Promise<void>;
  setSavedBike: (device: SavedDevice | null) => void;
  setSavedHrSource: (device: SavedDevice | null) => void;
  setBikeReconnectState: (state: ReconnectState) => void;
  setHrReconnectState: (state: ReconnectState) => void;
  persistBike: (device: SavedDevice) => Promise<void>;
  persistHr: (device: SavedDevice) => Promise<void>;
  removeBike: () => Promise<void>;
  removeHr: () => Promise<void>;
}

export const useSavedGearStore = create<SavedGearStore>((set, get) => ({
  savedBike: null,
  savedHrSource: null,
  hydrated: false,
  bikeReconnectState: 'idle',
  hrReconnectState: 'idle',

  hydrate: async () => {
    if (get().hydrated) return;
    const gear = await loadSavedGear();
    set({ savedBike: gear.savedBike, savedHrSource: gear.savedHrSource, hydrated: true });
  },

  setSavedBike: (device) => set({ savedBike: device }),
  setSavedHrSource: (device) => set({ savedHrSource: device }),
  setBikeReconnectState: (state) => set({ bikeReconnectState: state }),
  setHrReconnectState: (state) => set({ hrReconnectState: state }),

  persistBike: async (device) => {
    await saveBikeDevice(device);
    set({ savedBike: device, bikeReconnectState: 'connected' });
  },

  persistHr: async (device) => {
    await saveHrDevice(device);
    set({ savedHrSource: device, hrReconnectState: 'connected' });
  },

  removeBike: async () => {
    await forgetBikeDevice();
    set({ savedBike: null, bikeReconnectState: 'idle' });
  },

  removeHr: async () => {
    await forgetHrDevice();
    set({ savedHrSource: null, hrReconnectState: 'idle' });
  },
}));
