import { useEffect, useRef } from 'react';

import {
  appendSample,
  createDraftSession,
  discardDraftSession,
  finalizeSession,
  updateSessionStatus,
} from '../../../services/db/trainingSessionRepository';
import { useSavedGearStore } from '../../../store/savedGearStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import type { PersistedDeviceSnapshot } from '../../../types/sessionPersistence';
import type { SavedDevice } from '../../../types/gear';

const SESSION_ID_PREFIX = 'session';
const SAMPLE_ID_PREFIX = 'sample';
const RANDOM_RADIX = 36;
const RANDOM_ID_LENGTH = 8;

interface PersistedSessionSeed {
  sessionId: string;
  lastSampleSequence: number;
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

export function useTrainingSessionPersistence(isEnabled = true): void {
  const writeQueueRef = useRef(Promise.resolve());
  const activeSessionIdRef = useRef<string | null>(null);
  const persistedSessionIdRef = useRef<string | null>(null);
  const nextSampleSequenceRef = useRef(0);

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
      pendingPersistedSeed = null;
    };

    const clearActiveSession = (sessionId: string | null = null) => {
      if (sessionId === null || activeSessionIdRef.current === sessionId) {
        setActiveSessionId(null);
      }
      nextSampleSequenceRef.current = 0;
    };

    const clearPersistedSession = (sessionId: string | null = null) => {
      if (sessionId === null || persistedSessionIdRef.current === sessionId) {
        persistedSessionIdRef.current = null;
      }
    };

    applyPersistedSeed = hydratePersistedSession;
    if (pendingPersistedSeed) {
      hydratePersistedSession(pendingPersistedSeed);
    }

    const enqueue = (task: () => void, onError?: () => void) => {
      writeQueueRef.current = writeQueueRef.current
        .then(async () => {
          task();
        })
        .catch((error: unknown) => {
          onError?.();
          console.error('[useTrainingSessionPersistence] Failed to persist training session state:', error);
        });
    };

    const unsubscribe = useTrainingSessionStore.subscribe((state, previousState) => {
      if (previousState.phase === TrainingPhase.Idle && state.phase === TrainingPhase.Active) {
        const startedAtMs = Date.now();
        const sessionId = createEntityId(SESSION_ID_PREFIX, startedAtMs);
        const { savedBike, savedHrSource } = useSavedGearStore.getState();

        setActiveSessionId(sessionId);
        persistedSessionIdRef.current = null;
        nextSampleSequenceRef.current = 0;

        enqueue(
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
          },
          () => {
            if (activeSessionIdRef.current === sessionId) {
              clearActiveSession(sessionId);
              clearPersistedSession(sessionId);
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

        enqueue(() => {
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
        });

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
        enqueue(() => {
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
        enqueue(() => {
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
        enqueue(() => {
          if (persistedSessionIdRef.current !== sessionId) {
            return;
          }

          finalizeSession({
            sessionId,
            endedAtMs,
            updatedAtMs: endedAtMs,
            elapsedSeconds: state.elapsedSeconds,
            totalDistanceMeters: state.totalDistance,
            totalCaloriesKcal: state.totalCalories,
            currentMetrics: state.currentMetrics,
          });
        });
        return;
      }

      if (
        (previousState.phase === TrainingPhase.Active || previousState.phase === TrainingPhase.Paused) &&
        state.phase === TrainingPhase.Idle
      ) {
        clearActiveSession(sessionId);

        enqueue(() => {
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
        enqueue(() => {
          clearPersistedSession(sessionId);
        });
      }
    });

    return () => {
      unsubscribe();
      if (applyPersistedSeed === hydratePersistedSession) {
        applyPersistedSeed = null;
      }
      moduleActiveSessionId = null;
    };
  }, [isEnabled]);
}
