import { MetronomeEngine } from '../../services/metronome/MetronomeEngine';
import { useTrainingSessionStore } from '../../store/trainingSessionStore';
import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { BikeStatus } from '../../services/ble/BikeAdapter';
import { TrainingPhase, type TrainingSessionRestoreInput } from '../../types/training';
import { disconnectAllDeviceConnections } from './hooks/useDeviceConnection';
import { getActiveSessionId } from './hooks/useTrainingSessionPersistence';

const FINISH_STOP_COMMAND_TIMEOUT_MS = 2000;

/**
 * Single owner of the training session lifecycle.
 *
 * A ride is global state: it survives navigation, it is driven from Home, from
 * the Training dashboard and from the Watch, and it must be recorded by exactly
 * one 1 Hz clock. So the {@link MetronomeEngine} and the in-flight command state
 * live here, at module scope, instead of inside a screen-mounted hook. Screens
 * mount consumer hooks (`useTrainingSession`) that only read store state and
 * call these commands; they own nothing and clean up nothing.
 *
 * The engine is switched on and off by exactly one caller: the root-owned
 * `useTrainingSessionLifecycle`, which reconciles it against the store phase.
 * Commands therefore only move the phase, they never touch the engine.
 * `advanceSession` remains the pure per-tick reducer behind the store.
 */

/** Lazily created, then reused for the lifetime of the app process. */
let engine: MetronomeEngine | null = null;

/** In-flight FTMS Stop issued by finish, awaited before we disconnect. */
let pendingFinishStop: Promise<void> | null = null;

/** True while an intentional teardown is disconnecting the bike on purpose. */
let disconnectPauseSuppressed = false;

/**
 * True while the current Paused phase carries manual intent: a Pause issued by
 * the user (a screen or the Watch remote, both via {@link pauseSession}), or a
 * restored interrupted session (via {@link restoreSession}) waiting for the
 * user to deliberately resume it. Manual intent outranks bike telemetry, so
 * `syncSessionFromBikeStatus` must not auto-resume while this is true; only an
 * explicit {@link resumeSession} clears it. A bike-driven pause (reached via
 * `freezeActiveSession`) never sets it, so it stays eligible for bike-driven
 * resume.
 *
 * Scoped to one ride: both places a ride starts from Idle (`startSession` and
 * the Idle branch of `syncSessionFromBikeStatus`) clear it first, so a manual
 * pause from a previous ride can never carry over into the next one.
 */
let manualPauseActive = false;

// ── Engine supervision (root lifecycle only) ─────────────

/**
 * Reconcile the recording clock with the session phase: running while Active,
 * stopped otherwise. Idempotent, so a repeated phase notification is harmless.
 */
export function syncSessionEngineToPhase(phase: TrainingPhase): void {
  if (phase !== TrainingPhase.Active) {
    engine?.stop();
    return;
  }

  engine ??= new MetronomeEngine();
  engine.start();
}

/** Stop the recording clock. Safe to call when it was never started. */
export function stopSessionEngine(): void {
  engine?.stop();
}

/**
 * Whether the single recording clock is currently ticking.
 *
 * Observation seam for the module singleton, not dead code: it is the only way
 * to assert that Pause, Finish and Reset actually stop the timer rather than
 * merely leaving the store to discard its ticks (see
 * `__tests__/trainingSessionOwnership.test.ts`). Keep it.
 */
export function isSessionEngineRunning(): boolean {
  return engine?.isRunning() ?? false;
}

/** True while a deliberate disconnect is in progress, so a bike drop is not an error. */
export function isDisconnectPauseSuppressed(): boolean {
  return disconnectPauseSuppressed;
}

// ── Commands ─────────────────────────────────────────────

export function startSession(): void {
  if (useTrainingSessionStore.getState().phase !== TrainingPhase.Idle) {
    return;
  }

  const bikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
  if (!bikeAdapter) {
    console.warn('[sessionController] Cannot start session: bike not connected');
    return;
  }

  manualPauseActive = false;
  useTrainingSessionStore.getState().start();
  void bikeAdapter.setControlState(BikeStatus.Started);
}

export function pauseSession(): void {
  if (useTrainingSessionStore.getState().phase !== TrainingPhase.Active) {
    return;
  }

  useTrainingSessionStore.getState().pause();
  manualPauseActive = true;
  void useDeviceConnectionStore.getState().bikeAdapter?.setControlState(BikeStatus.Paused);
}

export function resumeSession(): void {
  if (useTrainingSessionStore.getState().phase !== TrainingPhase.Paused) {
    return;
  }

  const bikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
  if (!bikeAdapter) {
    console.warn('[sessionController] Cannot resume session: bike not connected');
    return;
  }

  useTrainingSessionStore.getState().resume();
  manualPauseActive = false;
  void bikeAdapter.setControlState(BikeStatus.Started);
}

/**
 * Restore a persisted, interrupted session as Paused.
 *
 * Like a manual pause, the restored ride waits for the user to deliberately
 * resume it: the user chose to bring this ride back, so a bike Started event
 * arriving before that choice must not resume it on its own.
 */
export function restoreSession(input: TrainingSessionRestoreInput): void {
  useTrainingSessionStore.getState().restore(input);
  manualPauseActive = true;
}

export function finishSession(): void {
  const phase = useTrainingSessionStore.getState().phase;
  if (phase !== TrainingPhase.Active && phase !== TrainingPhase.Paused) {
    return;
  }

  finishInternal();
}

export async function finishSessionAndDisconnect(): Promise<string | null> {
  const phase = useTrainingSessionStore.getState().phase;
  if (phase !== TrainingPhase.Active && phase !== TrainingPhase.Paused) {
    return null;
  }

  finishInternal();

  const sessionId = getActiveSessionId();

  await resetSessionAndConnections();

  return sessionId;
}

export async function resetSession(): Promise<void> {
  if (useTrainingSessionStore.getState().phase === TrainingPhase.Idle) {
    pendingFinishStop = null;
    return;
  }

  await resetSessionAndConnections();
}

/**
 * Pause a running ride without touching the bike: used when the bike stops
 * reporting, disconnects, or reports its own Paused/Stopped state.
 */
export function freezeActiveSession(): void {
  if (useTrainingSessionStore.getState().phase !== TrainingPhase.Active) {
    return;
  }

  useTrainingSessionStore.getState().pause();
}

/** Mirror a bike-reported status onto the session phase. */
export function syncSessionFromBikeStatus(status: BikeStatus): void {
  const phase = useTrainingSessionStore.getState().phase;

  if (status === BikeStatus.Started) {
    if (phase === TrainingPhase.Idle) {
      manualPauseActive = false;
      useTrainingSessionStore.getState().start();
    } else if (phase === TrainingPhase.Paused && !manualPauseActive) {
      // Manual intent outranks the bike: a user-initiated pause (or a restored
      // interrupted session) only clears via an explicit resumeSession() call.
      useTrainingSessionStore.getState().resume();
    }
    return;
  }

  // Ignore when already Paused: a Stopped echo can come from our own setControlState(Stopped) call.
  // When Active, both Paused and Stopped should freeze the session until the user resumes or finishes.
  if ((status === BikeStatus.Paused || status === BikeStatus.Stopped) && phase === TrainingPhase.Active) {
    freezeActiveSession();
  }
}

// ── Internals ────────────────────────────────────────────

function finishInternal(): void {
  const bikeAdapter = useDeviceConnectionStore.getState().bikeAdapter;
  if (bikeAdapter) {
    pendingFinishStop = bikeAdapter.setControlState(BikeStatus.Stopped).catch((err: unknown) => {
      console.error('[sessionController] Bike stop failed before disconnect:', err);
    });
  } else {
    pendingFinishStop = null;
  }

  useTrainingSessionStore.getState().finish();
}

async function awaitPendingFinishStop(): Promise<void> {
  const stopCommand = pendingFinishStop;
  if (!stopCommand) {
    return;
  }

  let timeoutId: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      stopCommand,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, FINISH_STOP_COMMAND_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    pendingFinishStop = null;
  }
}

async function resetSessionAndConnections(): Promise<void> {
  disconnectPauseSuppressed = true;

  try {
    // Teardown is the one place the owner stops the clock ahead of the phase:
    // a reset from Active keeps phase Active until the very end (so the ride
    // never flickers through Paused), and we must not keep accumulating into a
    // session that is being abandoned while the bike disconnects.
    stopSessionEngine();

    await awaitPendingFinishStop();

    // Release FTMS control so the bike exits "APP" mode and clears its display metrics.
    // Queued fire-and-forget so a stalled Stop cannot block this path; disconnect()'s own
    // command-queue drain (bounded by CONTROL_COMMAND_DRAIN_TIMEOUT_MS) flushes it before
    // cancelling BLE.
    const adapter = useDeviceConnectionStore.getState().bikeAdapter;
    adapter?.setControlState(BikeStatus.Reset).catch((err: unknown) => {
      console.error('[sessionController] Bike reset failed before disconnect:', err);
    });

    await disconnectAllDeviceConnections({ updateReconnectState: true, suppressAutoReconnect: true });
    useTrainingSessionStore.getState().reset();
  } finally {
    disconnectPauseSuppressed = false;
  }
}
