import { useCallback } from 'react';

import { ZiproRaveAdapter } from '../../../services/ble/ZiproRaveAdapter';
import { StandardHrAdapter } from '../../../services/ble/StandardHrAdapter';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import type { BikeMetrics } from '../../../services/ble/BikeAdapter';
import type { Subscription } from 'react-native-ble-plx';

/** Active BLE subscriptions, managed outside React state to avoid teardown races. */
let bikeMetricsSub: Subscription | null = null;
let hrSub: Subscription | null = null;

interface UseDeviceConnectionReturn {
  // ── Read-only state ────────────────────────────────────
  bikeConnected: boolean;
  hrConnected: boolean;
  latestBikeMetrics: BikeMetrics | null;
  latestHr: number | null;

  // ── Actions ────────────────────────────────────────────
  connectBike: (deviceId: string) => Promise<void>;
  connectHr: (deviceId: string) => Promise<void>;
  disconnectBike: () => Promise<void>;
  disconnectHr: () => Promise<void>;
  disconnectAll: () => Promise<void>;
}

/**
 * Public API hook for managing device connections in a training context.
 *
 * Unlike {@link useBikeConnection} (which handles scan & pair),
 * this hook manages the ongoing BLE subscriptions that feed data
 * into {@link useDeviceConnectionStore} during a training session.
 */
export function useDeviceConnection(): UseDeviceConnectionReturn {
  const bikeAdapter = useDeviceConnectionStore((s) => s.bikeAdapter);
  const hrAdapter = useDeviceConnectionStore((s) => s.hrAdapter);
  const latestBikeMetrics = useDeviceConnectionStore((s) => s.latestBikeMetrics);
  const latestHr = useDeviceConnectionStore((s) => s.latestHr);

  const disconnectBike = useCallback(async () => {
    bikeMetricsSub?.remove();
    bikeMetricsSub = null;

    const store = useDeviceConnectionStore.getState();
    const existingBikeAdapter = store.bikeAdapter;

    store.clearBikeConnection();

    try {
      await existingBikeAdapter?.disconnect();
    } catch (err: unknown) {
      console.error('[useDeviceConnection] Bike disconnect error:', err);
    }
  }, []);

  const disconnectHr = useCallback(async () => {
    hrSub?.remove();
    hrSub = null;

    const store = useDeviceConnectionStore.getState();
    const existingHrAdapter = store.hrAdapter;

    store.clearHrConnection();

    try {
      await existingHrAdapter?.disconnect();
    } catch (err: unknown) {
      console.error('[useDeviceConnection] HR disconnect error:', err);
    }
  }, []);

  const connectBike = useCallback(
    async (deviceId: string) => {
      try {
        await disconnectBike();

        const adapter = new ZiproRaveAdapter(deviceId);
        await adapter.connect();

        useDeviceConnectionStore.getState().setBikeAdapter(adapter);

        bikeMetricsSub = adapter.subscribeToMetrics((metrics: BikeMetrics) => {
          useDeviceConnectionStore.getState().updateBikeMetrics(metrics);
        });
      } catch (err: unknown) {
        console.error('[useDeviceConnection] Bike connection error:', err);
        throw err;
      }
    },
    [disconnectBike],
  );

  const connectHr = useCallback(
    async (deviceId: string) => {
      try {
        await disconnectHr();

        const adapter = new StandardHrAdapter(deviceId);
        await adapter.connect();

        useDeviceConnectionStore.getState().setHrAdapter(adapter);

        hrSub = adapter.subscribeToHeartRate((hr: number) => {
          useDeviceConnectionStore.getState().updateHr(hr);
        });
      } catch (err: unknown) {
        console.error('[useDeviceConnection] HR connection error:', err);
        throw err;
      }
    },
    [disconnectHr],
  );

  const disconnectAll = useCallback(async () => {
    await disconnectBike();
    await disconnectHr();
  }, [disconnectBike, disconnectHr]);

  return {
    bikeConnected: bikeAdapter !== null,
    hrConnected: hrAdapter !== null,
    latestBikeMetrics,
    latestHr,
    connectBike,
    connectHr,
    disconnectBike,
    disconnectHr,
    disconnectAll,
  };
}
