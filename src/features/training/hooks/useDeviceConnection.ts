import { useCallback } from 'react';

import { ZiproRaveAdapter } from '../../../services/ble/ZiproRaveAdapter';
import { StandardHrAdapter } from '../../../services/ble/StandardHrAdapter';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import type { BikeMetrics } from '../../../services/ble/BikeAdapter';
import type { BleConnectionOptions } from '../../../services/ble/BleConnectionOptions';
import type { DisconnectDeviceConnectionsOptions } from './DisconnectDeviceConnectionsOptions';
import type { Subscription } from 'react-native-ble-plx';
import { isExpectedBleConnectTimeoutError } from '../../../services/ble/isExpectedBleConnectTimeoutError';
import { isExpectedBleDisconnectError } from '../../../services/ble/isExpectedBleDisconnectError';

/** Active BLE subscriptions, managed outside React state to avoid teardown races. */
let bikeMetricsSub: Subscription | null = null;
let hrSub: Subscription | null = null;

function updateReconnectStateAfterBikeDisconnect(disconnectSucceeded: boolean, suppressAutoReconnect: boolean): void {
  const { savedBike, setBikeReconnectState, setBikeAutoReconnectSuppressed } = useSavedGearStore.getState();
  if (!savedBike) {
    setBikeReconnectState('idle');
    setBikeAutoReconnectSuppressed(false);
    return;
  }

  setBikeAutoReconnectSuppressed(suppressAutoReconnect);
  setBikeReconnectState(disconnectSucceeded ? 'disconnected' : 'failed');
}

function updateReconnectStateAfterHrDisconnect(disconnectSucceeded: boolean, suppressAutoReconnect: boolean): void {
  const { savedHrSource, setHrReconnectState, setHrAutoReconnectSuppressed } = useSavedGearStore.getState();
  if (!savedHrSource) {
    setHrReconnectState('idle');
    setHrAutoReconnectSuppressed(false);
    return;
  }

  setHrAutoReconnectSuppressed(suppressAutoReconnect);
  setHrReconnectState(disconnectSucceeded ? 'disconnected' : 'failed');
}

async function disconnectBikeConnectionInternal(options?: DisconnectDeviceConnectionsOptions): Promise<void> {
  const updateReconnectState = options?.updateReconnectState ?? false;
  const suppressAutoReconnect = options?.suppressAutoReconnect ?? false;
  bikeMetricsSub?.remove();
  bikeMetricsSub = null;

  const store = useDeviceConnectionStore.getState();
  const existingBikeAdapter = store.bikeAdapter;
  let disconnectSucceeded = true;

  if (existingBikeAdapter) {
    try {
      await existingBikeAdapter.disconnect();
    } catch (err: unknown) {
      if (!isExpectedBleDisconnectError(err)) {
        disconnectSucceeded = false;
        console.error('[useDeviceConnection] Bike disconnect error:', err);
      }
    }
  }

  store.clearBikeConnection();

  if (updateReconnectState) {
    updateReconnectStateAfterBikeDisconnect(disconnectSucceeded, suppressAutoReconnect);
  }
}

async function disconnectHrConnectionInternal(options?: DisconnectDeviceConnectionsOptions): Promise<void> {
  const updateReconnectState = options?.updateReconnectState ?? false;
  const suppressAutoReconnect = options?.suppressAutoReconnect ?? false;
  hrSub?.remove();
  hrSub = null;

  const store = useDeviceConnectionStore.getState();
  const existingHrAdapter = store.hrAdapter;
  let disconnectSucceeded = true;

  if (existingHrAdapter) {
    try {
      await existingHrAdapter.disconnect();
    } catch (err: unknown) {
      if (!isExpectedBleDisconnectError(err)) {
        disconnectSucceeded = false;
        console.error('[useDeviceConnection] HR disconnect error:', err);
      }
    }
  }

  store.clearHrConnection();

  if (updateReconnectState) {
    updateReconnectStateAfterHrDisconnect(disconnectSucceeded, suppressAutoReconnect);
  }
}

export async function disconnectAllDeviceConnections(options?: DisconnectDeviceConnectionsOptions): Promise<void> {
  await disconnectBikeConnectionInternal(options);
  await disconnectHrConnectionInternal(options);
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
  disconnectAll: (options?: DisconnectDeviceConnectionsOptions) => Promise<void>;
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
    await disconnectBikeConnectionInternal();
  }, []);

  const disconnectHr = useCallback(async () => {
    await disconnectHrConnectionInternal();
  }, []);

  const connectBike = useCallback(
    async (deviceId: string, options?: BleConnectionOptions) => {
      useDeviceConnectionStore.getState().setBikeConnectionInProgress(true);
      try {
        await disconnectBike();

        const adapter = new ZiproRaveAdapter(deviceId);

        await adapter.connect(options);

        useDeviceConnectionStore.getState().setBikeAdapter(adapter);
        useSavedGearStore.getState().setBikeAutoReconnectSuppressed(false);

        bikeMetricsSub = adapter.subscribeToMetrics((metrics: BikeMetrics) => {
          useDeviceConnectionStore.getState().updateBikeMetrics(metrics);
        });
      } catch (err: unknown) {
        if (!isExpectedBleDisconnectError(err) && !isExpectedBleConnectTimeoutError(err)) {
          console.error('[useDeviceConnection] Bike connection error:', err);
        }
        throw err;
      } finally {
        useDeviceConnectionStore.getState().setBikeConnectionInProgress(false);
      }
    },
    [disconnectBike],
  );

  const connectHr = useCallback(
    async (deviceId: string, options?: BleConnectionOptions) => {
      useDeviceConnectionStore.getState().setHrConnectionInProgress(true);
      try {
        await disconnectHr();

        const adapter = new StandardHrAdapter(deviceId);
        await adapter.connect(options);

        useDeviceConnectionStore.getState().setHrAdapter(adapter);
        useSavedGearStore.getState().setHrAutoReconnectSuppressed(false);

        hrSub = adapter.subscribeToHeartRate((hr: number) => {
          useDeviceConnectionStore.getState().updateHr(hr);
        });
      } catch (err: unknown) {
        if (!isExpectedBleDisconnectError(err) && !isExpectedBleConnectTimeoutError(err)) {
          console.error('[useDeviceConnection] HR connection error:', err);
        }
        throw err;
      } finally {
        useDeviceConnectionStore.getState().setHrConnectionInProgress(false);
      }
    },
    [disconnectHr],
  );

  const disconnectAll = useCallback(async (options?: DisconnectDeviceConnectionsOptions) => {
    await disconnectAllDeviceConnections({ updateReconnectState: true, ...options });
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
