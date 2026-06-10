import { create } from 'zustand';

import type { BikeAdapter, BikeMetrics } from '../services/ble/BikeAdapter';
import type { HrAdapter } from '../services/ble/HrAdapter';
import type { HrSource } from '../services/hr/hrSource';
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
  /**
   * Wall-clock timestamp of the most recent Bluetooth HR sample.
   * Used to detect stale BLE HR streams (mirrors lastAppleWatchSampleAtMs pattern).
   */
  lastBluetoothHrSampleAtMs: number | null;
  latestAppleWatchHr: number | null;
  latestAppleWatchActiveKcal: number | null;
  /**
   * Wall-clock timestamp of the most recent Apple Watch sample (HR or kcal).
   * Used by the engine to treat the stream as stale — and fall back to app /
   * bike calorie sources — when the Watch goes silent for several ticks.
   */
  lastAppleWatchSampleAtMs: number | null;
  watchAvailability: WatchAvailability;
  /**
   * The per-session locked HR source selected by the user (or auto-selected).
   * Null until a source is locked in for the session.
   */
  activeHrSource: HrSource | null;

  // ── Actions ────────────────────────────────────────────
  setBikeAdapter: (adapter: BikeAdapter | null) => void;
  setHrAdapter: (adapter: HrAdapter | null) => void;
  setBikeConnectionInProgress: (connecting: boolean) => void;
  setHrConnectionInProgress: (connecting: boolean) => void;
  updateBikeMetrics: (metrics: BikeMetrics) => void;
  updateBluetoothHr: (hr: number) => void;
  updateAppleWatchHr: (hr: number | null) => void;
  updateAppleWatchActiveKcal: (kcal: number | null) => void;
  setWatchAvailability: (availability: WatchAvailability) => void;
  setActiveHrSource: (source: HrSource | null) => void;
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
  lastBluetoothHrSampleAtMs: null,
  latestAppleWatchHr: null,
  latestAppleWatchActiveKcal: null,
  lastAppleWatchSampleAtMs: null,
  watchAvailability: 'unavailable',
  activeHrSource: null,

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
  updateBluetoothHr: (hr) => set({ latestBluetoothHr: hr, lastBluetoothHrSampleAtMs: Date.now() }),
  // HR arrives every 1 Hz on every Watch payload; treat it as the canonical
  // "stream alive" signal. kcal piggy-backs on the same payload but may be
  // absent until HealthKit produces its first active-energy sample.
  updateAppleWatchHr: (hr) =>
    set({ latestAppleWatchHr: hr, lastAppleWatchSampleAtMs: hr === null ? null : Date.now() }),
  updateAppleWatchActiveKcal: (kcal) => set({ latestAppleWatchActiveKcal: kcal }),
  setWatchAvailability: (watchAvailability) =>
    set((state) => (state.watchAvailability === watchAvailability ? state : { watchAvailability })),
  setActiveHrSource: (source) => set({ activeHrSource: source }),
  clearBikeConnection: () =>
    set({
      bikeAdapter: null,
      latestBikeMetrics: null,
      lastBikeSignalAtMs: null,
    }),
  // Apple Watch HR is independent of the BLE HR lifecycle, so only the Bluetooth
  // fields are cleared here. activeHrSource is also released: forgetting the BLE
  // strap invalidates any lock that pointed at it; the source is re-resolved from
  // the persisted primary on the next read (resolveEffectiveHrSource's ?? fallback).
  clearHrConnection: () =>
    set({
      hrAdapter: null,
      latestBluetoothHr: null,
      lastBluetoothHrSampleAtMs: null,
      activeHrSource: null,
    }),
  // Test-only reset. Clears the in-progress flags — calling this mid-connect would defeat the connect re-entrancy guard.
  clearAll: () =>
    set({
      bikeAdapter: null,
      hrAdapter: null,
      bikeConnectionInProgress: false,
      hrConnectionInProgress: false,
      latestBikeMetrics: null,
      lastBikeSignalAtMs: null,
      latestBluetoothHr: null,
      lastBluetoothHrSampleAtMs: null,
      latestAppleWatchHr: null,
      latestAppleWatchActiveKcal: null,
      lastAppleWatchSampleAtMs: null,
      watchAvailability: 'unavailable',
      activeHrSource: null,
    }),
}));
