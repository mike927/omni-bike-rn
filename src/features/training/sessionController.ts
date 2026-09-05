import { MetronomeEngine } from '../../services/metronome/MetronomeEngine';
import { useTrainingSessionStore } from '../../store/trainingSessionStore';
import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { BikeStatus } from '../../services/ble/BikeAdapter';
import { TrainingPhase, type TrainingSessionRestoreInput } from '../../types/training';
import { disconnectAllDeviceConnections, releaseDeviceDisconnectObservers } from './hooks/useDeviceConnection';
import {
  awaitSessionSave,
  discardUnsavedSessionRecord,
  getActiveSessionId,
  retrySessionSave,
} from './hooks/useTrainingSessionPersistence';

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

/** In-flight teardown, so overlapping callers join it instead of starting a second one. */
let pendingTeardown: Promise<void> | null = null;

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
 *
 * Self-guards like every sibling command: a ride already in memory (including a
 * finished one still waiting to be saved) outranks a restore, and overwriting it
 * would discard ride data the user can never get back.
 *
 * Returns whether the restore happened, so the caller can hold back everything
 * that belongs to the restored ride, its persisted identity above all, until the
 * guard has passed. A refused restore must leave no trace of the ride it refused.
 */
export function restoreSession(input: TrainingSessionRestoreInput): boolean {
  if (useTrainingSessionStore.getState().phase !== TrainingPhase.Idle) {
    console.warn('[sessionController] Cannot restore session: a ride is already in memory');
    return false;
  }

  useTrainingSessionStore.getState().restore(input);
  manualPauseActive = true;

  return true;
}

export function finishSession(): void {
  const phase = useTrainingSessionStore.getState().phase;
  if (phase !== TrainingPhase.Active && phase !== TrainingPhase.Paused) {
    return;
  }

  finishInternal();
}

/**
 * How a Finish ended.
 *
 * `completed` means the ride is on disk (or there was nothing to store) and the
 * session has been torn down; `sessionId` is what the summary route needs, and
 * is null when no ride was recorded. `unsaved` means the ride is over but its
 * write failed: it stays in memory, connected, and the caller must surface it
 * rather than navigate on as if it had been saved.
 */
export type FinishSessionOutcome =
  | { readonly status: 'completed'; readonly sessionId: string | null }
  | { readonly status: 'unsaved'; readonly message: string };

export async function finishSessionAndDisconnect(): Promise<FinishSessionOutcome> {
  const phase = useTrainingSessionStore.getState().phase;
  if (phase !== TrainingPhase.Active && phase !== TrainingPhase.Paused) {
    return { status: 'completed', sessionId: null };
  }

  finishInternal();

  return completeFinish();
}

/**
 * Write a finished ride again after its save failed, keeping its identity.
 *
 * The ride is still the one in memory, so a retry updates its row instead of
 * creating a second one; on success the teardown that the failed Finish skipped
 * runs here.
 */
export async function retryFinishSave(): Promise<FinishSessionOutcome> {
  if (useTrainingSessionStore.getState().phase !== TrainingPhase.Finished) {
    return { status: 'completed', sessionId: null };
  }

  const save = await retrySessionSave();
  if (!save.saved) {
    return { status: 'unsaved', message: save.message ?? 'Storage write failed' };
  }

  const sessionId = getActiveSessionId();
  await resetSessionAndConnections();

  return { status: 'completed', sessionId };
}

/**
 * How a Discard ended.
 *
 * `discarded` means the ride is gone from memory and from the device. `failed`
 * means it is gone from memory, because that is what the user asked for and it
 * always succeeds, but its row survived the delete and will be offered again at
 * the next boot as an interrupted ride. The caller has to say so.
 */
export type DiscardSessionOutcome =
  { readonly status: 'discarded' } | { readonly status: 'failed'; readonly message: string };

/**
 * Abandon a finished ride whose save failed, because the user said so.
 *
 * The only way out of the unsaved state other than a successful retry: nothing
 * else may drop a ride the user has not been shown.
 */
export async function discardUnsavedSession(): Promise<DiscardSessionOutcome> {
  if (useTrainingSessionStore.getState().phase !== TrainingPhase.Finished) {
    return { status: 'discarded' };
  }

  const discard = await discardUnsavedSessionRecord();

  // The teardown runs either way: the user asked to be rid of this ride, and
  // trapping them on the ride screen because the disk is broken would leave them
  // with no way out at all. What changes is what we then tell them.
  await resetSessionAndConnections();

  if (!discard.discarded) {
    return { status: 'failed', message: discard.message ?? 'Storage delete failed' };
  }

  return { status: 'discarded' };
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

/**
 * Settle the durable write of the ride that just finished, then tear down.
 *
 * The save is part of the lifecycle, not a side effect of it: teardown resets
 * the store, so it must not run until the ride is known to be on disk.
 */
async function completeFinish(): Promise<FinishSessionOutcome> {
  const save = await awaitSessionSave();
  if (!save.saved) {
    return { status: 'unsaved', message: save.message ?? 'Storage write failed' };
  }

  const sessionId = getActiveSessionId();
  await resetSessionAndConnections();

  return { status: 'completed', sessionId };
}

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

/**
 * Tear the ride down once, however many callers ask at the same time.
 *
 * A ride can be ended from a screen, from the wrist, and from the retry and
 * discard paths of a failed save. Without the latch two overlapping teardowns
 * would each disconnect the bike, and the first to finish would clear
 * `disconnectPauseSuppressed` while the second was still disconnecting, so the
 * deliberate drop would be reported as an unexpected one.
 */
async function resetSessionAndConnections(): Promise<void> {
  pendingTeardown ??= runResetSessionAndConnections().finally(() => {
    pendingTeardown = null;
  });

  return pendingTeardown;
}

async function runResetSessionAndConnections(): Promise<void> {
  disconnectPauseSuppressed = true;

  try {
    // The suppressed window starts here, not at disconnectAllDeviceConnections:
    // the pending finish Stop and the FTMS Reset below are each bounded by
    // timeouts of seconds, and a device dropping inside them is part of this
    // teardown. Disarm the transport observers for the whole window, so none of
    // it can be handled as an unexpected drop that lifts the suppression.
    releaseDeviceDisconnectObservers();

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
