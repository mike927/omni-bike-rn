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

  const connectBike = useCallback(async (deviceId: string) => {
    try {
      const adapter = new ZiproRaveAdapter(deviceId);
      await adapter.connect();

      useDeviceConnectionStore.getState().setBikeAdapter(adapter);

      bikeMetricsSub = adapter.subscribeToMetrics((metrics: BikeMetrics) => {
        useDeviceConnectionStore.getState().updateBikeMetrics(metrics);
      });

      console.log('[useDeviceConnection] Bike connected and subscribed:', deviceId);
    } catch (err: unknown) {
      console.error('[useDeviceConnection] Bike connection error:', err);
      throw err;
    }
  }, []);

  const connectHr = useCallback(async (deviceId: string) => {
    try {
      const adapter = new StandardHrAdapter(deviceId);
      await adapter.connect();

      useDeviceConnectionStore.getState().setHrAdapter(adapter);

      hrSub = adapter.subscribeToHeartRate((hr: number) => {
        useDeviceConnectionStore.getState().updateHr(hr);
      });

      console.log('[useDeviceConnection] HR monitor connected and subscribed:', deviceId);
    } catch (err: unknown) {
      console.error('[useDeviceConnection] HR connection error:', err);
      throw err;
    }
  }, []);

  const disconnectAll = useCallback(async () => {
    // Tear down subscriptions first
    bikeMetricsSub?.remove();
    bikeMetricsSub = null;
    hrSub?.remove();
    hrSub = null;

    const store = useDeviceConnectionStore.getState();

    try {
      await store.bikeAdapter?.disconnect();
    } catch (err: unknown) {
      console.error('[useDeviceConnection] Bike disconnect error:', err);
    }

    try {
      await store.hrAdapter?.disconnect();
    } catch (err: unknown) {
      console.error('[useDeviceConnection] HR disconnect error:', err);
    }

    store.clearAll();
    console.log('[useDeviceConnection] All devices disconnected');
  }, []);

  return {
    bikeConnected: bikeAdapter !== null,
    hrConnected: hrAdapter !== null,
    latestBikeMetrics,
    latestHr,
    connectBike,
    connectHr,
    disconnectAll,
  };
}
