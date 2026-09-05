import { useCallback } from 'react';

import { ZiproRaveAdapter } from '../../../services/ble/ZiproRaveAdapter';
import { StandardHrAdapter } from '../../../services/ble/StandardHrAdapter';
import { bleManager } from '../../../services/ble/bleClient';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import type { BikeAdapter, BikeMetrics } from '../../../services/ble/BikeAdapter';
import type { HrAdapter } from '../../../services/ble/HrAdapter';
import type { BleConnectionOptions } from '../../../services/ble/BleConnectionOptions';
import type { DisconnectDeviceConnectionsOptions } from './DisconnectDeviceConnectionsOptions';
import type { Subscription } from 'react-native-ble-plx';
import { isExpectedBleConnectTimeoutError } from '../../../services/ble/isExpectedBleConnectTimeoutError';
import { isExpectedBleDisconnectError } from '../../../services/ble/isExpectedBleDisconnectError';
import { ConnectInProgressError } from '../../../services/ble/ConnectInProgressError';
import type { WatchAvailability } from '../../../types/watch';

/** Active BLE subscriptions, managed outside React state to avoid teardown races. */
let bikeMetricsSub: Subscription | null = null;
let hrSub: Subscription | null = null;

/**
 * Native disconnection observers, one per connected role.
 *
 * A peripheral that loses power or leaves range never tells the app through its
 * data stream: `monitorCharacteristic` simply goes quiet, and the "was
 * disconnected" error it may raise is indistinguishable from a deliberate
 * teardown. Only `bleManager.onDeviceDisconnected` reports the transport itself
 * going away, so it is what the connection owner watches. Sample silence is
 * never treated as a disconnection.
 *
 * Held here rather than in React state for the same reason as the data
 * subscriptions: they must survive every screen and be releasable by existence.
 */
let bikeDisconnectSub: Subscription | null = null;
let hrDisconnectSub: Subscription | null = null;

/** Release the bike's native disconnection observer if one is registered. */
function releaseBikeDisconnectObserver(): void {
  bikeDisconnectSub?.remove();
  bikeDisconnectSub = null;
}

/** Release the HR strap's native disconnection observer if one is registered. */
function releaseHrDisconnectObserver(): void {
  hrDisconnectSub?.remove();
  hrDisconnectSub = null;
}

/**
 * Disarm every role's native disconnection observer.
 *
 * A deliberate teardown is not an instant: it drains the bike's command queue
 * and awaits each cancellation, which is seconds of wall clock. Releasing only
 * the role currently being torn down leaves the other one armed for that whole
 * window, so a genuine drop inside it is handled as an unexpected one and lifts
 * the suppression the teardown has just applied, leaving a reconnected strap
 * alive after the ride ended. Every deliberate teardown therefore disarms both
 * roles up front, before it touches either one.
 *
 * Releasing by existence keeps this idempotent, so an outer teardown and the
 * per-role ones it delegates to can both call it.
 */
export function releaseDeviceDisconnectObservers(): void {
  releaseBikeDisconnectObserver();
  releaseHrDisconnectObserver();
}

/**
 * Watch `deviceId` for native disconnection on behalf of `adapter`.
 *
 * The listener is identity-guarded against `adapter`, not against `deviceId`:
 * BLE events can arrive late, and a drop reported for an adapter that has since
 * been replaced (a reconnect to the same device included) must not tear down the
 * adapter that replaced it.
 */
function observeBikeDisconnect(deviceId: string, adapter: BikeAdapter): void {
  releaseBikeDisconnectObserver();
  bikeDisconnectSub = bleManager.onDeviceDisconnected(deviceId, () => {
    if (useDeviceConnectionStore.getState().bikeAdapter !== adapter) {
      return;
    }
    void handleUnexpectedBikeDisconnect();
  });
}

/** HR counterpart of {@link observeBikeDisconnect}, with the same identity guard. */
function observeHrDisconnect(deviceId: string, adapter: HrAdapter): void {
  releaseHrDisconnectObserver();
  hrDisconnectSub = bleManager.onDeviceDisconnected(deviceId, () => {
    if (useDeviceConnectionStore.getState().hrAdapter !== adapter) {
      return;
    }
    void handleUnexpectedHrDisconnect();
  });
}

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

export async function handleUnexpectedBikeDisconnect(): Promise<void> {
  releaseBikeDisconnectObserver();
  bikeMetricsSub?.remove();
  bikeMetricsSub = null;

  const store = useDeviceConnectionStore.getState();
  const existingBikeAdapter = store.bikeAdapter;

  store.clearBikeConnection();
  updateReconnectStateAfterBikeDisconnect(true, false);

  if (!existingBikeAdapter) {
    return;
  }

  try {
    await existingBikeAdapter.disconnect();
  } catch (err: unknown) {
    if (!isExpectedBleDisconnectError(err)) {
      console.error('[useDeviceConnection] Unexpected bike disconnect cleanup error:', err);
    }
  }
}

async function disconnectBikeConnectionInternal(options?: DisconnectDeviceConnectionsOptions): Promise<void> {
  const updateReconnectState = options?.updateReconnectState ?? false;
  const suppressAutoReconnect = options?.suppressAutoReconnect ?? false;
  // Before the disconnect, not after: cancelling the connection raises the very
  // same native event, and a deliberate teardown must not be reported back to us
  // as an unexpected drop that lifts the suppression it just applied.
  releaseBikeDisconnectObserver();
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

/**
 * Give up the HR connection a dropped strap left behind.
 *
 * Mirrors {@link handleUnexpectedBikeDisconnect}: release the subscriptions by
 * whether they exist, drop the transport, and hand the strap back to the
 * reconnect cycle. The per-session HR lock stays put, because an out-of-range
 * strap is not a change of HR source.
 */
async function handleUnexpectedHrDisconnect(): Promise<void> {
  releaseHrDisconnectObserver();
  hrSub?.remove();
  hrSub = null;

  const store = useDeviceConnectionStore.getState();
  const existingHrAdapter = store.hrAdapter;

  store.clearHrTransport();
  updateReconnectStateAfterHrDisconnect(true, false);

  if (!existingHrAdapter) {
    return;
  }

  try {
    await existingHrAdapter.disconnect();
  } catch (err: unknown) {
    if (!isExpectedBleDisconnectError(err)) {
      console.error('[useDeviceConnection] Unexpected HR disconnect cleanup error:', err);
    }
  }
}

/**
 * Extra knob for the HR teardown that only its internal callers need.
 *
 * A deliberate disconnect ends the ride's relationship with this source, so it
 * releases the per-session lock as well. The cleanup `connectHr` runs before
 * dialling is not that: it replaces the transport under a ride that is still
 * choosing the same source, so it opts out.
 */
interface DisconnectHrConnectionOptions extends DisconnectDeviceConnectionsOptions {
  readonly keepActiveHrSource?: boolean;
}

async function disconnectHrConnectionInternal(options?: DisconnectHrConnectionOptions): Promise<void> {
  const updateReconnectState = options?.updateReconnectState ?? false;
  const suppressAutoReconnect = options?.suppressAutoReconnect ?? false;
  const keepActiveHrSource = options?.keepActiveHrSource ?? false;
  // See disconnectBikeConnectionInternal: the observer goes first so our own
  // cancellation is not mistaken for the strap dropping off the air.
  releaseHrDisconnectObserver();
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

  if (keepActiveHrSource) {
    store.clearHrTransport();
  } else {
    store.clearHrConnection();
  }

  if (updateReconnectState) {
    updateReconnectStateAfterHrDisconnect(disconnectSucceeded, suppressAutoReconnect);
  }
}

export async function disconnectAllDeviceConnections(options?: DisconnectDeviceConnectionsOptions): Promise<void> {
  // Both roles first: the bike teardown alone can take seconds, and a strap that
  // drops inside that window is part of this teardown, not a drop that should
  // reopen the reconnect cycle the teardown is closing.
  releaseDeviceDisconnectObservers();
  // The HR half always runs, even if the bike half throws: both observers were
  // just disarmed above, so a throw between them (e.g. a subscription's
  // `remove()` failing) must not leave the HR role live in the store with no
  // way left to observe a real drop on it.
  try {
    await disconnectBikeConnectionInternal(options);
  } finally {
    await disconnectHrConnectionInternal(options);
  }
}

/**
 * Dial the bike and take ownership of the connection it produces.
 *
 * Module scope rather than a hook callback: connecting is global work that only
 * touches the stores, and both the screens (through {@link useDeviceConnection})
 * and the app-boot reconnect owner (`reconnectController`) have to start it. One
 * implementation of "connect the bike", not one per caller.
 */
export async function connectBikeDevice(deviceId: string, options?: BleConnectionOptions): Promise<void> {
  // A second connect while one is in flight would construct a competing
  // adapter: the loser leaks its BLE connection and clobbers bikeMetricsSub.
  if (useDeviceConnectionStore.getState().bikeConnectionInProgress) {
    throw new ConnectInProgressError('bike');
  }
  useDeviceConnectionStore.getState().setBikeConnectionInProgress(true);
  try {
    await disconnectBikeConnectionInternal();

    const adapter = new ZiproRaveAdapter(deviceId);

    await adapter.connect(options);

    useDeviceConnectionStore.getState().setBikeAdapter(adapter);
    useSavedGearStore.getState().setBikeAutoReconnectSuppressed(false);
    observeBikeDisconnect(deviceId, adapter);

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
}

/** HR counterpart of {@link connectBikeDevice}, with the same re-entrancy guard. */
export async function connectHrDevice(deviceId: string, options?: BleConnectionOptions): Promise<void> {
  if (useDeviceConnectionStore.getState().hrConnectionInProgress) {
    throw new ConnectInProgressError('hr');
  }
  useDeviceConnectionStore.getState().setHrConnectionInProgress(true);
  try {
    // Transport-only: a reconnect probe must not drop the ride's locked HR
    // source on its way to restoring it.
    await disconnectHrConnectionInternal({ keepActiveHrSource: true });

    const adapter = new StandardHrAdapter(deviceId);
    await adapter.connect(options);

    useDeviceConnectionStore.getState().setHrAdapter(adapter);
    useSavedGearStore.getState().setHrAutoReconnectSuppressed(false);
    observeHrDisconnect(deviceId, adapter);

    hrSub = adapter.subscribeToHeartRate((hr: number) => {
      useDeviceConnectionStore.getState().updateBluetoothHr(hr);
    });
  } catch (err: unknown) {
    if (!isExpectedBleDisconnectError(err) && !isExpectedBleConnectTimeoutError(err)) {
      console.error('[useDeviceConnection] HR connection error:', err);
    }
    throw err;
  } finally {
    useDeviceConnectionStore.getState().setHrConnectionInProgress(false);
  }
}

/**
 * Deliberate single-role bike teardown, disarming only the bike's transport
 * observer so a strap drop inside it stays a real drop.
 */
export async function disconnectBikeDevice(): Promise<void> {
  await disconnectBikeConnectionInternal();
}

/** HR counterpart of {@link disconnectBikeDevice}. */
export async function disconnectHrDevice(): Promise<void> {
  await disconnectHrConnectionInternal();
}

interface UseDeviceConnectionReturn {
  // ── Read-only state ────────────────────────────────────
  bikeConnected: boolean;
  hrConnected: boolean;
  latestBikeMetrics: BikeMetrics | null;
  latestBluetoothHr: number | null;
  latestAppleWatchHr: number | null;
  lastAppleWatchSampleAtMs: number | null;
  watchAvailability: WatchAvailability;

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
 * This hook manages the ongoing BLE subscriptions that feed data into
 * {@link useDeviceConnectionStore} during a training session.
 */
export function useDeviceConnection(): UseDeviceConnectionReturn {
  const bikeAdapter = useDeviceConnectionStore((s) => s.bikeAdapter);
  const hrAdapter = useDeviceConnectionStore((s) => s.hrAdapter);
  const latestBikeMetrics = useDeviceConnectionStore((s) => s.latestBikeMetrics);
  const latestBluetoothHr = useDeviceConnectionStore((s) => s.latestBluetoothHr);
  const latestAppleWatchHr = useDeviceConnectionStore((s) => s.latestAppleWatchHr);
  const lastAppleWatchSampleAtMs = useDeviceConnectionStore((s) => s.lastAppleWatchSampleAtMs);
  const watchAvailability = useDeviceConnectionStore((s) => s.watchAvailability);

  // All four delegate to the module-scope operations: nothing about connecting
  // or disconnecting depends on the hook, so a screen gets the same behaviour as
  // the app-boot reconnect owner rather than a second implementation of it.
  const disconnectBike = useCallback(async () => {
    await disconnectBikeDevice();
  }, []);

  const disconnectHr = useCallback(async () => {
    await disconnectHrDevice();
  }, []);

  const connectBike = useCallback(async (deviceId: string, options?: BleConnectionOptions) => {
    await connectBikeDevice(deviceId, options);
  }, []);

  const connectHr = useCallback(async (deviceId: string, options?: BleConnectionOptions) => {
    await connectHrDevice(deviceId, options);
  }, []);

  const disconnectAll = useCallback(async (options?: DisconnectDeviceConnectionsOptions) => {
    await disconnectAllDeviceConnections({ updateReconnectState: true, ...options });
  }, []);

  return {
    bikeConnected: bikeAdapter !== null,
    hrConnected: hrAdapter !== null,
    latestBikeMetrics,
    latestBluetoothHr,
    latestAppleWatchHr,
    lastAppleWatchSampleAtMs,
    watchAvailability,
    connectBike,
    connectHr,
    disconnectBike,
    disconnectHr,
    disconnectAll,
  };
}
