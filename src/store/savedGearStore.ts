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
  bikeAutoReconnectSuppressed: boolean;
  hrAutoReconnectSuppressed: boolean;

  hydrate: () => Promise<void>;
  setSavedBike: (device: SavedDevice | null) => void;
  setSavedHrSource: (device: SavedDevice | null) => void;
  setBikeReconnectState: (state: ReconnectState) => void;
  setHrReconnectState: (state: ReconnectState) => void;
  setBikeAutoReconnectSuppressed: (suppressed: boolean) => void;
  setHrAutoReconnectSuppressed: (suppressed: boolean) => void;
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
  bikeAutoReconnectSuppressed: false,
  hrAutoReconnectSuppressed: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const gear = await loadSavedGear();
    set({ savedBike: gear.savedBike, savedHrSource: gear.savedHrSource, hydrated: true });
  },

  setSavedBike: (device) => set({ savedBike: device, bikeAutoReconnectSuppressed: false }),
  setSavedHrSource: (device) => set({ savedHrSource: device, hrAutoReconnectSuppressed: false }),
  setBikeReconnectState: (state) => set({ bikeReconnectState: state }),
  setHrReconnectState: (state) => set({ hrReconnectState: state }),
  setBikeAutoReconnectSuppressed: (suppressed) => set({ bikeAutoReconnectSuppressed: suppressed }),
  setHrAutoReconnectSuppressed: (suppressed) => set({ hrAutoReconnectSuppressed: suppressed }),

  persistBike: async (device) => {
    await saveBikeDevice(device);
    set({ savedBike: device, bikeReconnectState: 'connected', bikeAutoReconnectSuppressed: false });
  },

  persistHr: async (device) => {
    await saveHrDevice(device);
    set({ savedHrSource: device, hrReconnectState: 'connected', hrAutoReconnectSuppressed: false });
  },

  removeBike: async () => {
    await forgetBikeDevice();
    set({ savedBike: null, bikeReconnectState: 'idle', bikeAutoReconnectSuppressed: false });
  },

  removeHr: async () => {
    await forgetHrDevice();
    set({ savedHrSource: null, hrReconnectState: 'idle', hrAutoReconnectSuppressed: false });
  },
}));
