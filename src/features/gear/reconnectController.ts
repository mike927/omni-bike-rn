import { isExpectedBleConnectTimeoutError } from '../../services/ble/isExpectedBleConnectTimeoutError';
import { isExpectedBleDisconnectError } from '../../services/ble/isExpectedBleDisconnectError';
import { isConnectInProgressError } from '../../services/ble/ConnectInProgressError';
import {
  connectBikeDevice,
  connectHrDevice,
  disconnectBikeDevice,
  disconnectHrDevice,
} from '../training/hooks/useDeviceConnection';
import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../store/savedGearStore';
import type { ReconnectState } from '../../types/gear';

/**
 * Single owner of auto-reconnect policy.
 *
 * Reconnecting saved gear is global, exactly like the ride: there is one bike
 * and one strap, one retry budget for each, and a cycle that has to survive the
 * user walking from Home to Training to Settings. So the probe timers, the
 * attempt counters and the in-flight attempt bookkeeping live here, at module
 * scope, instead of inside a screen-mounted hook where every mounted screen
 * carried its own copy and one cycle's behaviour depended on which screens
 * happened to be mounted.
 *
 * The policy is driven by exactly one caller: the root-owned
 * `useAutoReconnectLifecycle`, mounted from `useAppInitialization`, which
 * reconciles it against the saved-gear and connection stores and against app
 * foreground state. Screens mount `useAutoReconnect`, which only reads the
 * reconnect state the stores already publish and forwards the Retry commands
 * below; it owns nothing and cleans up nothing.
 *
 * Auto-reconnect fires at most {@link MAX_AUTO_RECONNECT_ATTEMPTS} probes after
 * a drop: probe 1 immediately (0 ms), probe 2 after 3 s, probe 3 after 5 s. Once
 * the last probe fails the device is left `disconnected` (shown as
 * "Unavailable") until the user taps Connect, which resets the cycle.
 */
const AUTO_RECONNECT_RETRY_DELAYS_MS = [0, 3000, 5000] as const;
const MAX_AUTO_RECONNECT_ATTEMPTS = AUTO_RECONNECT_RETRY_DELAYS_MS.length;

/**
 * Per-role scheduling state.
 *
 * One record per role, never shared: a bike cycle and a strap cycle run at the
 * same time with their own budgets, and spending one must not spend the other.
 */
interface ReconnectRuntime {
  /** True from the moment a probe is dialled until it settles. */
  attempting: boolean;
  /** Device the in-flight probe is dialling, so a forgotten device is disowned. */
  attemptDeviceId: string | null;
  /** Pending wait before the next probe. */
  retryTimeout: ReturnType<typeof setTimeout> | null;
  /** Probes already spent in the current cycle. */
  attemptCount: number;
}

function createRuntime(): ReconnectRuntime {
  return { attempting: false, attemptDeviceId: null, retryTimeout: null, attemptCount: 0 };
}

const bikeRuntime = createRuntime();
const hrRuntime = createRuntime();

/**
 * Last foreground state the lifecycle owner reported.
 *
 * The only policy input that is not in a store, so it is remembered here for the
 * one path that reconciles without the owner asking: a transient probe failure
 * scheduling its successor.
 */
let appIsActive = true;

/**
 * Whether an owner is currently driving the policy.
 *
 * A probe outlives the pass that dialled it, so one can settle after the owner
 * has stood the policy down and ask for its successor. Nothing may arm a timer
 * that nobody is left to reconcile, so the scheduler refuses while this is
 * false; only the owner's own reconciliation sets it back.
 */
let policyOwned = false;

/** What the policy needs to know about one role, read once per reconciliation. */
interface ReconnectSnapshot {
  readonly hydrated: boolean;
  readonly savedDeviceId: string | null;
  readonly reconnectState: ReconnectState;
  readonly autoReconnectSuppressed: boolean;
  readonly adapterPresent: boolean;
  readonly connectionInProgress: boolean;
}

function readBikeSnapshot(): ReconnectSnapshot {
  const gear = useSavedGearStore.getState();
  const connection = useDeviceConnectionStore.getState();
  return {
    hydrated: gear.hydrated,
    savedDeviceId: gear.savedBike?.id ?? null,
    reconnectState: gear.bikeReconnectState,
    autoReconnectSuppressed: gear.bikeAutoReconnectSuppressed,
    adapterPresent: connection.bikeAdapter !== null,
    connectionInProgress: connection.bikeConnectionInProgress,
  };
}

function readHrSnapshot(): ReconnectSnapshot {
  const gear = useSavedGearStore.getState();
  const connection = useDeviceConnectionStore.getState();
  return {
    hydrated: gear.hydrated,
    savedDeviceId: gear.savedHrSource?.id ?? null,
    reconnectState: gear.hrReconnectState,
    autoReconnectSuppressed: gear.hrAutoReconnectSuppressed,
    adapterPresent: connection.hrAdapter !== null,
    connectionInProgress: connection.hrConnectionInProgress,
  };
}

function toReconnectFailureState(err: unknown): 'failed' | 'disconnected' {
  return isExpectedBleDisconnectError(err) || isExpectedBleConnectTimeoutError(err) || isConnectInProgressError(err)
    ? 'disconnected'
    : 'failed';
}

/** `attemptCount` = probes already made; returns the wait before the next probe. */
function nextAutoReconnectDelayMs(attemptCount: number): number {
  return AUTO_RECONNECT_RETRY_DELAYS_MS[attemptCount] ?? 0;
}

function clearRetryTimeout(runtime: ReconnectRuntime): void {
  if (runtime.retryTimeout !== null) {
    clearTimeout(runtime.retryTimeout);
    runtime.retryTimeout = null;
  }
}

function setBikeReconnectState(state: ReconnectState): void {
  useSavedGearStore.getState().setBikeReconnectState(state);
}

function setHrReconnectState(state: ReconnectState): void {
  useSavedGearStore.getState().setHrReconnectState(state);
}

/** Whether the device a probe is dialling is still the one the user has saved. */
function isCurrentSavedBike(deviceId: string): boolean {
  return useSavedGearStore.getState().savedBike?.id === deviceId;
}

function isCurrentSavedHr(deviceId: string): boolean {
  return useSavedGearStore.getState().savedHrSource?.id === deviceId;
}

// ── Reconciliation ───────────────────────────────────────

/**
 * Run one pass of the bike policy against a single store snapshot.
 *
 * One snapshot per pass is deliberate: the four steps have to agree on one view
 * of the world, the way the four effects this replaced all agreed on one render.
 * A step whose store write invalidates the snapshot re-enters through the
 * owner's next reconciliation, not mid-pass.
 */
function reconcileBikeReconnect(appActive: boolean): void {
  appIsActive = appActive;

  const snapshot = readBikeSnapshot();
  autoConnectBike(snapshot);
  adoptLiveBikeAdapter(snapshot);
  markBikeConnectionLost(snapshot);
  scheduleBikeProbe(snapshot, appActive);
}

/** HR counterpart of {@link reconcileBikeReconnect}. */
function reconcileHrReconnect(appActive: boolean): void {
  appIsActive = appActive;

  const snapshot = readHrSnapshot();
  autoConnectHr(snapshot);
  adoptLiveHrAdapter(snapshot);
  markHrConnectionLost(snapshot);
  scheduleHrProbe(snapshot, appActive);
}

// ── Probes ───────────────────────────────────────────────

async function startBikeReconnect(deviceId: string): Promise<void> {
  if (bikeRuntime.attempting) {
    return;
  }

  bikeRuntime.attempting = true;
  bikeRuntime.attemptDeviceId = deviceId;
  setBikeReconnectState('connecting');

  try {
    await connectBikeDevice(deviceId);
    bikeRuntime.attemptCount = 0;
    clearRetryTimeout(bikeRuntime);
    if (!isCurrentSavedBike(deviceId)) {
      await disconnectBikeDevice();
      bikeRuntime.attempting = false;
      bikeRuntime.attemptDeviceId = null;
      return;
    }
    bikeRuntime.attempting = false;
    bikeRuntime.attemptDeviceId = null;
    setBikeReconnectState('connected');
  } catch (err: unknown) {
    if (!isCurrentSavedBike(deviceId)) {
      bikeRuntime.attempting = false;
      bikeRuntime.attemptDeviceId = null;
      return;
    }
    bikeRuntime.attempting = false;
    bikeRuntime.attemptDeviceId = null;
    const nextState = toReconnectFailureState(err);

    if (nextState === 'failed') {
      bikeRuntime.attemptCount = 0;
      clearRetryTimeout(bikeRuntime);
      setBikeReconnectState('failed');
      console.error('[reconnectController] Bike connect failed:', err);
      return;
    }

    // Transient drop: count this probe and, while the budget remains, stay in
    // the `connecting` display state and schedule the next probe so the chip
    // reads one continuous "Connecting…". Only once the budget is spent do we
    // fall back to `disconnected` (rendered as "Unavailable").
    bikeRuntime.attemptCount += 1;
    if (bikeRuntime.attemptCount >= MAX_AUTO_RECONNECT_ATTEMPTS) {
      clearRetryTimeout(bikeRuntime);
      setBikeReconnectState('disconnected');
      return;
    }
    setBikeReconnectState('connecting');
    // The store did not change (it was already `connecting`), so nothing would
    // wake the owner: this cycle schedules its own successor. Through the
    // internal pass, so a probe settling after teardown cannot revive a policy
    // that no longer has an owner.
    reconcileBikeReconnect(appIsActive);
  }
}

async function startHrReconnect(deviceId: string): Promise<void> {
  if (hrRuntime.attempting) {
    return;
  }

  hrRuntime.attempting = true;
  hrRuntime.attemptDeviceId = deviceId;
  setHrReconnectState('connecting');

  try {
    await connectHrDevice(deviceId);
    hrRuntime.attemptCount = 0;
    clearRetryTimeout(hrRuntime);
    if (!isCurrentSavedHr(deviceId)) {
      await disconnectHrDevice();
      hrRuntime.attempting = false;
      hrRuntime.attemptDeviceId = null;
      return;
    }
    hrRuntime.attempting = false;
    hrRuntime.attemptDeviceId = null;
    setHrReconnectState('connected');
  } catch (err: unknown) {
    if (!isCurrentSavedHr(deviceId)) {
      hrRuntime.attempting = false;
      hrRuntime.attemptDeviceId = null;
      return;
    }
    hrRuntime.attempting = false;
    hrRuntime.attemptDeviceId = null;
    const nextState = toReconnectFailureState(err);

    if (nextState === 'failed') {
      hrRuntime.attemptCount = 0;
      clearRetryTimeout(hrRuntime);
      setHrReconnectState('failed');
      console.error('[reconnectController] HR connect failed:', err);
      return;
    }

    // See startBikeReconnect: one continuous "Connecting…" until the budget is spent.
    hrRuntime.attemptCount += 1;
    if (hrRuntime.attemptCount >= MAX_AUTO_RECONNECT_ATTEMPTS) {
      clearRetryTimeout(hrRuntime);
      setHrReconnectState('disconnected');
      return;
    }
    setHrReconnectState('connecting');
    reconcileHrReconnect(appIsActive);
  }
}

// ── Reconciliation steps ─────────────────────────────────

/** Dial a saved device that has never been tried in this cycle. */
function autoConnectBike(snapshot: ReconnectSnapshot): void {
  if (!snapshot.hydrated) return;
  if (snapshot.savedDeviceId === null) return;
  if (snapshot.autoReconnectSuppressed) return;
  if (snapshot.reconnectState !== 'idle') return;
  if (snapshot.adapterPresent) return;
  void startBikeReconnect(snapshot.savedDeviceId);
}

function autoConnectHr(snapshot: ReconnectSnapshot): void {
  if (!snapshot.hydrated) return;
  if (snapshot.savedDeviceId === null) return;
  if (snapshot.autoReconnectSuppressed) return;
  if (snapshot.reconnectState !== 'idle') return;
  if (snapshot.adapterPresent) return;
  void startHrReconnect(snapshot.savedDeviceId);
}

/**
 * Adopt a connection somebody else made (the gear-setup flow, most often).
 *
 * A live adapter is proof of a live connection, so the cycle stands down and its
 * budget resets. An in-flight probe for a device that is no longer the saved one
 * is left alone: that probe will disown its own connection when it settles.
 */
function adoptLiveBikeAdapter(snapshot: ReconnectSnapshot): void {
  if (!snapshot.adapterPresent) return;

  const pendingAttemptDeviceId = bikeRuntime.attemptDeviceId;
  if (bikeRuntime.attempting && (!pendingAttemptDeviceId || !isCurrentSavedBike(pendingAttemptDeviceId))) {
    return;
  }

  bikeRuntime.attempting = false;
  bikeRuntime.attemptDeviceId = null;
  bikeRuntime.attemptCount = 0;
  clearRetryTimeout(bikeRuntime);
  if (snapshot.reconnectState !== 'connected') {
    setBikeReconnectState('connected');
  }
}

function adoptLiveHrAdapter(snapshot: ReconnectSnapshot): void {
  if (!snapshot.adapterPresent) return;

  const pendingAttemptDeviceId = hrRuntime.attemptDeviceId;
  if (hrRuntime.attempting && (!pendingAttemptDeviceId || !isCurrentSavedHr(pendingAttemptDeviceId))) {
    return;
  }

  hrRuntime.attempting = false;
  hrRuntime.attemptDeviceId = null;
  hrRuntime.attemptCount = 0;
  clearRetryTimeout(hrRuntime);
  if (snapshot.reconnectState !== 'connected') {
    setHrReconnectState('connected');
  }
}

/** A connection we believed in has gone (post-workout disconnect included). */
function markBikeConnectionLost(snapshot: ReconnectSnapshot): void {
  if (snapshot.savedDeviceId === null) return;
  if (snapshot.reconnectState !== 'connected') return;
  if (snapshot.adapterPresent) return;
  if (bikeRuntime.attempting || snapshot.connectionInProgress) return;

  setBikeReconnectState('disconnected');
}

function markHrConnectionLost(snapshot: ReconnectSnapshot): void {
  if (snapshot.savedDeviceId === null) return;
  if (snapshot.reconnectState !== 'connected') return;
  if (snapshot.adapterPresent) return;
  if (hrRuntime.attempting || snapshot.connectionInProgress) return;

  setHrReconnectState('disconnected');
}

function scheduleBikeProbe(snapshot: ReconnectSnapshot, appActive: boolean): void {
  if (!policyOwned) {
    clearRetryTimeout(bikeRuntime);
    return;
  }

  if (!appActive) {
    clearRetryTimeout(bikeRuntime);
    return;
  }

  if (!snapshot.hydrated || snapshot.savedDeviceId === null) {
    clearRetryTimeout(bikeRuntime);
    bikeRuntime.attemptCount = 0;
    return;
  }

  if (snapshot.autoReconnectSuppressed) {
    clearRetryTimeout(bikeRuntime);
    return;
  }

  // A reconnect cycle is live while the state is `connecting` (active probe or
  // waiting between probes) or `disconnected` (a fresh drop). Once the probe
  // budget is spent we stop and leave the device disconnected (Unavailable).
  const needsReconnect = snapshot.reconnectState === 'connecting' || snapshot.reconnectState === 'disconnected';
  if (
    !needsReconnect ||
    snapshot.adapterPresent ||
    bikeRuntime.attempting ||
    snapshot.connectionInProgress ||
    bikeRuntime.attemptCount >= MAX_AUTO_RECONNECT_ATTEMPTS
  ) {
    clearRetryTimeout(bikeRuntime);
    return;
  }

  const deviceId = snapshot.savedDeviceId;
  clearRetryTimeout(bikeRuntime);
  bikeRuntime.retryTimeout = setTimeout(() => {
    bikeRuntime.retryTimeout = null;
    void startBikeReconnect(deviceId);
  }, nextAutoReconnectDelayMs(bikeRuntime.attemptCount));
}

function scheduleHrProbe(snapshot: ReconnectSnapshot, appActive: boolean): void {
  if (!policyOwned) {
    clearRetryTimeout(hrRuntime);
    return;
  }

  if (!appActive) {
    clearRetryTimeout(hrRuntime);
    return;
  }

  if (!snapshot.hydrated || snapshot.savedDeviceId === null) {
    clearRetryTimeout(hrRuntime);
    hrRuntime.attemptCount = 0;
    return;
  }

  if (snapshot.autoReconnectSuppressed) {
    clearRetryTimeout(hrRuntime);
    return;
  }

  // See scheduleBikeProbe for what counts as a live cycle.
  const needsReconnect = snapshot.reconnectState === 'connecting' || snapshot.reconnectState === 'disconnected';
  if (
    !needsReconnect ||
    snapshot.adapterPresent ||
    hrRuntime.attempting ||
    snapshot.connectionInProgress ||
    hrRuntime.attemptCount >= MAX_AUTO_RECONNECT_ATTEMPTS
  ) {
    clearRetryTimeout(hrRuntime);
    return;
  }

  const deviceId = snapshot.savedDeviceId;
  clearRetryTimeout(hrRuntime);
  hrRuntime.retryTimeout = setTimeout(() => {
    hrRuntime.retryTimeout = null;
    void startHrReconnect(deviceId);
  }, nextAutoReconnectDelayMs(hrRuntime.attemptCount));
}

// ── Owner entry points (root lifecycle only) ─────────────

/**
 * Reconcile the bike's reconnect cycle with the stores and foreground state.
 *
 * Idempotent, so a repeated notification is harmless: every step guards on the
 * snapshot and the scheduler re-arms the same wait it was already serving.
 */
export function syncBikeReconnect(appActive: boolean): void {
  policyOwned = true;
  reconcileBikeReconnect(appActive);
}

/** HR counterpart of {@link syncBikeReconnect}. */
export function syncHrReconnect(appActive: boolean): void {
  policyOwned = true;
  reconcileHrReconnect(appActive);
}

/**
 * Stand the policy down, for both roles.
 *
 * Called when the owner itself goes away, which in the app means the whole tree
 * is being torn down. Releasing by existence keeps it idempotent.
 */
export function releaseReconnectSchedules(): void {
  policyOwned = false;
  for (const runtime of [bikeRuntime, hrRuntime]) {
    clearRetryTimeout(runtime);
    runtime.attempting = false;
    runtime.attemptDeviceId = null;
    runtime.attemptCount = 0;
  }
}

// ── Commands (screens) ───────────────────────────────────

/**
 * Dial the saved bike because the user asked, from wherever they asked.
 *
 * An explicit Retry always starts a fresh cycle: it lifts the suppression a
 * deliberate disconnect left behind and returns the full probe budget.
 */
export function retryBikeConnection(): void {
  const gear = useSavedGearStore.getState();
  const savedBike = gear.savedBike;
  if (!gear.hydrated || !savedBike) {
    return;
  }

  bikeRuntime.attemptCount = 0;
  clearRetryTimeout(bikeRuntime);
  gear.setBikeAutoReconnectSuppressed(false);

  if (useDeviceConnectionStore.getState().bikeAdapter !== null) {
    gear.setBikeReconnectState('connected');
    return;
  }

  void startBikeReconnect(savedBike.id);
}

/** HR counterpart of {@link retryBikeConnection}. */
export function retryHrConnection(): void {
  const gear = useSavedGearStore.getState();
  const savedHrSource = gear.savedHrSource;
  if (!gear.hydrated || !savedHrSource) {
    return;
  }

  hrRuntime.attemptCount = 0;
  clearRetryTimeout(hrRuntime);
  gear.setHrAutoReconnectSuppressed(false);

  if (useDeviceConnectionStore.getState().hrAdapter !== null) {
    gear.setHrReconnectState('connected');
    return;
  }

  void startHrReconnect(savedHrSource.id);
}
