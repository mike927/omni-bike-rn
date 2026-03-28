import { useCallback } from 'react';

import { ZiproRaveAdapter } from '../../../services/ble/ZiproRaveAdapter';
import { StandardHrAdapter } from '../../../services/ble/StandardHrAdapter';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import type { BikeMetrics } from '../../../services/ble/BikeAdapter';
import type { BleConnectionOptions } from '../../../services/ble/BleConnectionOptions';
import type { DisconnectDeviceConnectionsOptions } from './DisconnectDeviceConnectionsOptions';
import type { Subscription } from 'react-native-ble-plx';
import { isExpectedBleDisconnectError } from '../../../services/ble/isExpectedBleDisconnectError';

/** Active BLE subscriptions, managed outside React state to avoid teardown races. */
let bikeMetricsSub: Subscription | null = null;
let hrSub: Subscription | null = null;

function updateReconnectStateAfterBikeDisconnect(): void {
  const { savedBike, setBikeReconnectState } = useSavedGearStore.getState();
  setBikeReconnectState(savedBike ? 'disconnected' : 'idle');
}

function updateReconnectStateAfterHrDisconnect(): void {
  const { savedHrSource, setHrReconnectState } = useSavedGearStore.getState();
  setHrReconnectState(savedHrSource ? 'disconnected' : 'idle');
}

async function disconnectBikeConnectionInternal(updateReconnectState: boolean): Promise<void> {
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

  if (updateReconnectState) {
    updateReconnectStateAfterBikeDisconnect();
  }
}

async function disconnectHrConnectionInternal(updateReconnectState: boolean): Promise<void> {
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

  if (updateReconnectState) {
    updateReconnectStateAfterHrDisconnect();
  }
}

export async function disconnectAllDeviceConnections(options?: DisconnectDeviceConnectionsOptions): Promise<void> {
  const updateReconnectState = options?.updateReconnectState ?? false;
  await disconnectBikeConnectionInternal(updateReconnectState);
  await disconnectHrConnectionInternal(updateReconnectState);
}

interface UseDeviceConnectionReturn {
  // ── Read-only state ────────────────────────────────────
  bikeConnected: boolean;
  hrConnected: boolean;
  latestBikeMetrics: BikeMetrics | null;
  latestHr: number | null;

  // ── Actions ────────────────────────────────────────────
  connectBike: (deviceId: string, options?: BleConnectionOptions) => Promise<void>;
  connectHr: (deviceId: string, options?: BleConnectionOptions) => Promise<void>;
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
    await disconnectBikeConnectionInternal(false);
  }, []);

  const disconnectHr = useCallback(async () => {
    await disconnectHrConnectionInternal(false);
  }, []);

  const connectBike = useCallback(
    async (deviceId: string, options?: BleConnectionOptions) => {
      try {
        await disconnectBike();

        const adapter = new ZiproRaveAdapter(deviceId);

        await adapter.connect(options);

        useDeviceConnectionStore.getState().setBikeAdapter(adapter);

        bikeMetricsSub = adapter.subscribeToMetrics((metrics: BikeMetrics) => {
          useDeviceConnectionStore.getState().updateBikeMetrics(metrics);
        });
      } catch (err: unknown) {
        if (!isExpectedBleDisconnectError(err)) {
          console.error('[useDeviceConnection] Bike connection error:', err);
        }
        throw err;
      }
    },
    [disconnectBike],
  );

  const connectHr = useCallback(
    async (deviceId: string, options?: BleConnectionOptions) => {
      try {
        await disconnectHr();

        const adapter = new StandardHrAdapter(deviceId);
        await adapter.connect(options);

        useDeviceConnectionStore.getState().setHrAdapter(adapter);

        hrSub = adapter.subscribeToHeartRate((hr: number) => {
          useDeviceConnectionStore.getState().updateHr(hr);
        });
      } catch (err: unknown) {
        if (!isExpectedBleDisconnectError(err)) {
          console.error('[useDeviceConnection] HR connection error:', err);
        }
        throw err;
      }
    },
    [disconnectHr],
  );

  const disconnectAll = useCallback(async () => {
    await disconnectAllDeviceConnections({ updateReconnectState: true });
  }, []);

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
