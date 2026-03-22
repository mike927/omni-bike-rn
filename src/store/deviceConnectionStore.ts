import { create } from 'zustand';

import type { BikeAdapter, BikeMetrics } from '../services/ble/BikeAdapter';
import type { HrAdapter } from '../services/ble/HrAdapter';

/**
 * Holds connected device adapters and their latest raw readings.
 *
 * BLE subscription callbacks write here; the MetronomeEngine reads on each tick.
 *
 * Designed for extension — adding a new sensor type (e.g. Apple Watch)
 * means adding a new adapter slot + setter, with no changes to existing code.
 */
export interface DeviceConnectionStore {
  // ── Adapters ───────────────────────────────────────────
  bikeAdapter: BikeAdapter | null;
  hrAdapter: HrAdapter | null;

  // ── Latest raw readings ────────────────────────────────
  latestBikeMetrics: BikeMetrics | null;
  latestHr: number | null;

  // ── Actions ────────────────────────────────────────────
  setBikeAdapter: (adapter: BikeAdapter | null) => void;
  setHrAdapter: (adapter: HrAdapter | null) => void;
  updateBikeMetrics: (metrics: BikeMetrics) => void;
  updateHr: (hr: number) => void;
  clearAll: () => void;
}

export const useDeviceConnectionStore = create<DeviceConnectionStore>((set) => ({
  bikeAdapter: null,
  hrAdapter: null,
  latestBikeMetrics: null,
  latestHr: null,

  setBikeAdapter: (adapter) => set({ bikeAdapter: adapter }),
  setHrAdapter: (adapter) => set({ hrAdapter: adapter }),
  updateBikeMetrics: (metrics) => set({ latestBikeMetrics: metrics }),
  updateHr: (hr) => set({ latestHr: hr }),
  clearAll: () =>
    set({
      bikeAdapter: null,
      hrAdapter: null,
      latestBikeMetrics: null,
      latestHr: null,
    }),
}));
