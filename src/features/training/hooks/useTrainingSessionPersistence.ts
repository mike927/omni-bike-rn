import { useEffect, useRef } from 'react';

import {
  appendSample,
  createDraftSession,
  discardDraftSession,
  finalizeSession,
  updateSessionStatus,
} from '../../../services/db/trainingSessionRepository';
import { useSavedGearStore } from '../../../store/savedGearStore';
import { useSessionPersistenceStore } from '../../../store/sessionPersistenceStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import type { PersistedDeviceSnapshot, PersistedTrainingSummary } from '../../../types/sessionPersistence';
import type { SavedDevice } from '../../../types/gear';

const SESSION_ID_PREFIX = 'session';
const SAMPLE_ID_PREFIX = 'sample';
const RANDOM_RADIX = 36;
const RANDOM_ID_LENGTH = 8;
const MS_PER_SECOND = 1000;

interface PersistedSessionSeed {
  sessionId: string;
  lastSampleSequence: number;
}

/** Durable outcome of writing the ride that just ended. */
export interface SessionSaveOutcome {
  /** False only when the ride is finished and is NOT on disk. */
  readonly saved: boolean;
  readonly sessionId: string | null;
  readonly message: string | null;
}

/**
 * Module-level reference to the active session ID managed by the persistence
 * hook. Allows external callers (e.g. {@link useTrainingSession}) to read the
 * current session ID without coupling to the hook's internal refs.
 *
 * Safe to call only while {@link useTrainingSessionPersistence} is mounted.
 */
let moduleActiveSessionId: string | null = null;
let pendingPersistedSeed: PersistedSessionSeed | null = null;
let applyPersistedSeed: ((seed: PersistedSessionSeed) => void) | null = null;

/**
 * Serialized SQLite writes for the ride. Module-scoped, like the active session
 * ID, because the hook is mounted exactly once from the app-boot hook and the
 * lifecycle has to be able to await this queue from outside React (audit A02).
 */
let sessionWriteQueue: Promise<void> = Promise.resolve();

/**
 * Durable write of a finished ride, registered by the mounted hook. Creates the
 * session row first when the draft never reached storage, so the same call both
 * finishes a healthy ride and rescues one that was never written.
 */
let runFinishedSessionWrite: ((sessionId: string, endedAtMs: number) => void) | null = null;
/** Deletes whatever was written for a ride, registered by the mounted hook. */
let runSessionRecordDiscard: ((sessionId: string) => void) | null = null;

export function getActiveSessionId(): string | null {
  return moduleActiveSessionId;
}

export function seedFromPersistedSession(sessionId: string, lastSampleSequence: number): void {
  const seed = { sessionId, lastSampleSequence };

  if (applyPersistedSeed) {
    applyPersistedSeed(seed);
    return;
  }

  pendingPersistedSeed = seed;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function enqueueWrite(task: () => void, onError?: (error: unknown) => void): void {
  sessionWriteQueue = sessionWriteQueue
    .then(async () => {
      task();
    })
    .catch((error: unknown) => {
      onError?.(error);
      console.error('[useTrainingSessionPersistence] Failed to persist training session state:', error);
    });
}

/** Wait for every queued write to settle, including ones queued while waiting. */
async function flushSessionWrites(): Promise<void> {
  let drained: Promise<void> | null = null;

  while (drained !== sessionWriteQueue) {
    drained = sessionWriteQueue;
    await drained;
  }
}

function readSaveOutcome(sessionId: string | null): SessionSaveOutcome {
  const { status, lastErrorMessage } = useSessionPersistenceStore.getState();

  if (status === 'unsaved') {
    return { saved: false, sessionId, message: lastErrorMessage ?? 'Storage write failed' };
  }

  return { saved: true, sessionId, message: null };
}

/**
 * Drain the pending writes and report whether the finished ride is on disk.
 *
 * The session controller awaits this before it tears a ride down: a Finish that
 * did not reach storage must not look like one that did.
 */
export async function awaitSessionSave(): Promise<SessionSaveOutcome> {
  await flushSessionWrites();
  return readSaveOutcome(moduleActiveSessionId);
}

/**
 * Write a finished-but-unsaved ride again, under its original identity.
 *
 * Deliberately manual and one-shot: the user asks for it from the ride screen.
 * Re-running the same write is what keeps identity stable, so a retry updates
 * the ride's row instead of creating a second one.
 */
export async function retrySessionSave(): Promise<SessionSaveOutcome> {
  const sessionId = moduleActiveSessionId;
  const write = runFinishedSessionWrite;

  if (!sessionId || !write) {
    return { saved: true, sessionId, message: null };
  }

  const endedAtMs = Date.now();
  enqueueWrite(
    () => {
      write(sessionId, endedAtMs);
      useSessionPersistenceStore.getState().markSaved(sessionId);
    },
    (error) => {
      useSessionPersistenceStore.getState().markUnsaved(sessionId, describeError(error));
    },
  );

  await flushSessionWrites();
  return readSaveOutcome(sessionId);
}

/** Delete a ride the user has explicitly chosen to abandon. */
export async function discardUnsavedSessionRecord(): Promise<void> {
  const sessionId = moduleActiveSessionId;
  const discard = runSessionRecordDiscard;

  if (sessionId && discard) {
    enqueueWrite(() => {
      discard(sessionId);
    });
    await flushSessionWrites();
  }

  useSessionPersistenceStore.getState().clear();
}

function toDeviceSnapshot(device: SavedDevice | null): PersistedDeviceSnapshot | null {
  if (!device) {
    return null;
  }

  return {
    id: device.id,
    name: device.name,
  };
}

function createEntityId(prefix: string, nowMs: number): string {
  const randomPart = Math.random()
    .toString(RANDOM_RADIX)
    .slice(2, 2 + RANDOM_ID_LENGTH);
  return `${prefix}-${nowMs}-${randomPart}`;
}

function currentSessionSummary(): PersistedTrainingSummary {
  const state = useTrainingSessionStore.getState();

  return {
    elapsedSeconds: state.elapsedSeconds,
    totalDistanceMeters: state.totalDistance,
    totalCaloriesKcal: state.totalCalories,
    currentMetrics: state.currentMetrics,
  };
}

export function useTrainingSessionPersistence(isEnabled = true): void {
  const activeSessionIdRef = useRef<string | null>(null);
  const persistedSessionIdRef = useRef<string | null>(null);
  const nextSampleSequenceRef = useRef(0);
  const startedAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const setActiveSessionId = (id: string | null) => {
      activeSessionIdRef.current = id;
      moduleActiveSessionId = id;
    };

    const hydratePersistedSession = ({ sessionId, lastSampleSequence }: PersistedSessionSeed) => {
      setActiveSessionId(sessionId);
      persistedSessionIdRef.current = sessionId;
      nextSampleSequenceRef.current = lastSampleSequence + 1;
      startedAtMsRef.current = null;
      pendingPersistedSeed = null;
      useSessionPersistenceStore.getState().beginSession(sessionId);
    };

    const clearActiveSession = (sessionId: string | null = null) => {
      if (sessionId === null || activeSessionIdRef.current === sessionId) {
        setActiveSessionId(null);
      }
      nextSampleSequenceRef.current = 0;
      startedAtMsRef.current = null;
    };

    const clearPersistedSession = (sessionId: string | null = null) => {
      if (sessionId === null || persistedSessionIdRef.current === sessionId) {
        persistedSessionIdRef.current = null;
      }
    };

    const writeFinishedSession = (sessionId: string, endedAtMs: number) => {
      const summary = currentSessionSummary();

      if (persistedSessionIdRef.current !== sessionId) {
        // The draft never reached storage. Write the ride now, under the same
        // identity, so a storage failure at the start costs the per-second
        // samples rather than the whole ride.
        const { savedBike, savedHrSource } = useSavedGearStore.getState();
        createDraftSession({
          sessionId,
          startedAtMs: startedAtMsRef.current ?? endedAtMs - summary.elapsedSeconds * MS_PER_SECOND,
          ...summary,
          savedBikeSnapshot: toDeviceSnapshot(savedBike),
          savedHrSnapshot: toDeviceSnapshot(savedHrSource),
        });
        persistedSessionIdRef.current = sessionId;
      }

      finalizeSession({ sessionId, endedAtMs, updatedAtMs: endedAtMs, ...summary });
    };

    const discardSessionRecord = (sessionId: string) => {
      if (persistedSessionIdRef.current !== sessionId) {
        return;
      }

      discardDraftSession(sessionId);
      clearPersistedSession(sessionId);
    };

    applyPersistedSeed = hydratePersistedSession;
    runFinishedSessionWrite = writeFinishedSession;
    runSessionRecordDiscard = discardSessionRecord;
    if (pendingPersistedSeed) {
      hydratePersistedSession(pendingPersistedSeed);
    }

    const unsubscribe = useTrainingSessionStore.subscribe((state, previousState) => {
      if (previousState.phase === TrainingPhase.Idle && state.phase === TrainingPhase.Active) {
        const startedAtMs = Date.now();
        const sessionId = createEntityId(SESSION_ID_PREFIX, startedAtMs);
        const { savedBike, savedHrSource } = useSavedGearStore.getState();

        setActiveSessionId(sessionId);
        persistedSessionIdRef.current = null;
        nextSampleSequenceRef.current = 0;
        startedAtMsRef.current = startedAtMs;
        useSessionPersistenceStore.getState().beginSession(sessionId);

        enqueueWrite(
          () => {
            createDraftSession({
              sessionId,
              startedAtMs,
              elapsedSeconds: state.elapsedSeconds,
              totalDistanceMeters: state.totalDistance,
              totalCaloriesKcal: state.totalCalories,
              currentMetrics: state.currentMetrics,
              savedBikeSnapshot: toDeviceSnapshot(savedBike),
              savedHrSnapshot: toDeviceSnapshot(savedHrSource),
            });
            if (activeSessionIdRef.current !== sessionId) {
              discardDraftSession(sessionId);
              return;
            }

            persistedSessionIdRef.current = sessionId;
            useSessionPersistenceStore.getState().markRecording(sessionId);
          },
          (error) => {
            // Keep the identity: the ride carries on in memory, samples are
            // skipped because nothing durable exists to attach them to, and the
            // Finish path writes the ride under this same ID.
            if (activeSessionIdRef.current === sessionId) {
              clearPersistedSession(sessionId);
              useSessionPersistenceStore.getState().markAtRisk(sessionId, describeError(error));
            }
          },
        );

        return;
      }

      if (state.phase === TrainingPhase.Active && state.elapsedSeconds > previousState.elapsedSeconds) {
        const sessionId = activeSessionIdRef.current;
        if (!sessionId) {
          return;
        }

        const recordedAtMs = Date.now();
        const sequence = nextSampleSequenceRef.current;
        nextSampleSequenceRef.current += 1;

        enqueueWrite(
          () => {
            if (persistedSessionIdRef.current !== sessionId) {
              return;
            }

            appendSample({
              sessionId,
              sampleId: createEntityId(`${SAMPLE_ID_PREFIX}-${sequence}`, recordedAtMs),
              sequence,
              recordedAtMs,
              elapsedSeconds: state.elapsedSeconds,
              totalDistanceMeters: state.totalDistance,
              totalCaloriesKcal: state.totalCalories,
              currentMetrics: state.currentMetrics,
            });
          },
          (error) => {
            // Bounded by design: the second is counted and abandoned. Buffering
            // it would grow without limit while the disk stays broken, and the
            // ride totals are rewritten in full when it is finalized.
            useSessionPersistenceStore.getState().markSampleDropped(sessionId, describeError(error));
          },
        );

        return;
      }

      if (state.phase === previousState.phase) {
        return;
      }

      const sessionId = activeSessionIdRef.current;
      if (!sessionId) {
        return;
      }

      if (previousState.phase === TrainingPhase.Active && state.phase === TrainingPhase.Paused) {
        const updatedAtMs = Date.now();
        enqueueWrite(() => {
          if (persistedSessionIdRef.current !== sessionId) {
            return;
          }

          updateSessionStatus({
            sessionId,
            status: 'paused',
            updatedAtMs,
          });
        });
        return;
      }

      if (previousState.phase === TrainingPhase.Paused && state.phase === TrainingPhase.Active) {
        const updatedAtMs = Date.now();
        enqueueWrite(() => {
          if (persistedSessionIdRef.current !== sessionId) {
            return;
          }

          updateSessionStatus({
            sessionId,
            status: 'active',
            updatedAtMs,
          });
        });
        return;
      }

      if (
        (previousState.phase === TrainingPhase.Active || previousState.phase === TrainingPhase.Paused) &&
        state.phase === TrainingPhase.Finished
      ) {
        const endedAtMs = Date.now();
        enqueueWrite(
          () => {
            writeFinishedSession(sessionId, endedAtMs);
            useSessionPersistenceStore.getState().markSaved(sessionId);
          },
          (error) => {
            // The ride is over and is not on disk. Say so: the controller keeps
            // it in memory and the screen offers Retry or Discard.
            useSessionPersistenceStore.getState().markUnsaved(sessionId, describeError(error));
          },
        );
        return;
      }

      if (
        (previousState.phase === TrainingPhase.Active || previousState.phase === TrainingPhase.Paused) &&
        state.phase === TrainingPhase.Idle
      ) {
        clearActiveSession(sessionId);
        useSessionPersistenceStore.getState().clear();

        enqueueWrite(() => {
          if (persistedSessionIdRef.current !== sessionId) {
            return;
          }

          discardDraftSession(sessionId);
          clearPersistedSession(sessionId);
        });
        return;
      }

      if (previousState.phase === TrainingPhase.Finished && state.phase === TrainingPhase.Idle) {
        clearActiveSession(sessionId);
        useSessionPersistenceStore.getState().clear();
        enqueueWrite(() => {
          clearPersistedSession(sessionId);
        });
      }
    });

    return () => {
      unsubscribe();
      if (applyPersistedSeed === hydratePersistedSession) {
        applyPersistedSeed = null;
      }
      if (runFinishedSessionWrite === writeFinishedSession) {
        runFinishedSessionWrite = null;
      }
      if (runSessionRecordDiscard === discardSessionRecord) {
        runSessionRecordDiscard = null;
      }
      moduleActiveSessionId = null;
    };
  }, [isEnabled]);
}
