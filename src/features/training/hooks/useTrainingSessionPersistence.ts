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

    const clearActiveSession = (sessionId: string | null = null) => {
      if (sessionId === null || activeSessionIdRef.current === sessionId) {
        activeSessionIdRef.current = null;
      }
      nextSampleSequenceRef.current = 0;
    };

    const clearPersistedSession = (sessionId: string | null = null) => {
      if (sessionId === null || persistedSessionIdRef.current === sessionId) {
        persistedSessionIdRef.current = null;
      }
    };

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

        activeSessionIdRef.current = sessionId;
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
    };
  }, [isEnabled]);
}
