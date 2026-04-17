import { create } from 'zustand';

import type { BikeAdapter, BikeMetrics } from '../services/ble/BikeAdapter';
import type { HrAdapter } from '../services/ble/HrAdapter';
import type { WatchAvailability } from '../types/watch';

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
  bikeConnectionInProgress: boolean;
  hrConnectionInProgress: boolean;

  // ── Latest raw readings ────────────────────────────────
  latestBikeMetrics: BikeMetrics | null;
  lastBikeSignalAtMs: number | null;
  latestBluetoothHr: number | null;
  latestAppleWatchHr: number | null;
  watchAvailability: WatchAvailability;

  // ── Actions ────────────────────────────────────────────
  setBikeAdapter: (adapter: BikeAdapter | null) => void;
  setHrAdapter: (adapter: HrAdapter | null) => void;
  setBikeConnectionInProgress: (connecting: boolean) => void;
  setHrConnectionInProgress: (connecting: boolean) => void;
  updateBikeMetrics: (metrics: BikeMetrics) => void;
  updateBluetoothHr: (hr: number) => void;
  updateAppleWatchHr: (hr: number | null) => void;
  setWatchAvailability: (availability: WatchAvailability) => void;
  clearBikeConnection: () => void;
  clearHrConnection: () => void;
  clearAll: () => void;
}

export const useDeviceConnectionStore = create<DeviceConnectionStore>((set) => ({
  bikeAdapter: null,
  hrAdapter: null,
  bikeConnectionInProgress: false,
  hrConnectionInProgress: false,
  latestBikeMetrics: null,
  lastBikeSignalAtMs: null,
  latestBluetoothHr: null,
  latestAppleWatchHr: null,
  watchAvailability: 'unavailable',

  setBikeAdapter: (adapter) =>
    set({
      bikeAdapter: adapter,
      lastBikeSignalAtMs: adapter ? Date.now() : null,
    }),
  setHrAdapter: (adapter) => set({ hrAdapter: adapter }),
  setBikeConnectionInProgress: (connecting) => set({ bikeConnectionInProgress: connecting }),
  setHrConnectionInProgress: (connecting) => set({ hrConnectionInProgress: connecting }),
  updateBikeMetrics: (metrics) =>
    set({
      latestBikeMetrics: metrics,
      lastBikeSignalAtMs: Date.now(),
    }),
  updateBluetoothHr: (hr) => set({ latestBluetoothHr: hr }),
  updateAppleWatchHr: (hr) => set({ latestAppleWatchHr: hr }),
  setWatchAvailability: (watchAvailability) =>
    set((state) => (state.watchAvailability === watchAvailability ? state : { watchAvailability })),
  clearBikeConnection: () =>
    set({
      bikeAdapter: null,
      latestBikeMetrics: null,
      lastBikeSignalAtMs: null,
    }),
  // Apple Watch HR is independent of the BLE HR lifecycle — only clear Bluetooth here.
  clearHrConnection: () =>
    set({
      hrAdapter: null,
      latestBluetoothHr: null,
    }),
  clearAll: () =>
    set({
      bikeAdapter: null,
      hrAdapter: null,
      bikeConnectionInProgress: false,
      hrConnectionInProgress: false,
      latestBikeMetrics: null,
      lastBikeSignalAtMs: null,
      latestBluetoothHr: null,
      latestAppleWatchHr: null,
      watchAvailability: 'unavailable',
    }),
}));
