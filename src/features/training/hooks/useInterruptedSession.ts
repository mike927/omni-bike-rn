import { useCallback } from 'react';

import { discardDraftSession, getLastSampleSequence } from '../../../services/db/trainingSessionRepository';
import { useInterruptedSessionStore } from '../../../store/interruptedSessionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase, type TrainingSessionRestoreInput } from '../../../types/training';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';
import { seedFromPersistedSession } from './useTrainingSessionPersistence';

function toRestoreInput(session: PersistedTrainingSession): TrainingSessionRestoreInput {
  return {
    elapsedSeconds: session.elapsedSeconds,
    totalDistance: session.totalDistanceMeters,
    totalCalories: session.totalCaloriesKcal,
    currentMetrics: session.currentMetrics,
  };
}

interface UseInterruptedSessionReturn {
  interruptedSession: PersistedTrainingSession | null;
  resumeInterruptedSession: () => boolean;
  discardInterruptedSession: () => boolean;
}

export function useInterruptedSession(): UseInterruptedSessionReturn {
  const interruptedSession = useInterruptedSessionStore((s) => s.interruptedSession);

  const resumeInterruptedSession = useCallback(() => {
    if (!interruptedSession) {
      return false;
    }

    if (useTrainingSessionStore.getState().phase !== TrainingPhase.Idle) {
      console.error('[useInterruptedSession] Cannot restore while another in-memory session is active.');
      return false;
    }

    const lastSampleSequence = getLastSampleSequence(interruptedSession.id);
    seedFromPersistedSession(interruptedSession.id, lastSampleSequence);
    useTrainingSessionStore.getState().restore(toRestoreInput(interruptedSession));
    useInterruptedSessionStore.getState().clear();

    return true;
  }, [interruptedSession]);

  const discardInterruptedSession = useCallback(() => {
    if (!interruptedSession) {
      return false;
    }

    discardDraftSession(interruptedSession.id);
    useInterruptedSessionStore.getState().clear();

    return true;
  }, [interruptedSession]);

  return {
    interruptedSession,
    resumeInterruptedSession,
    discardInterruptedSession,
  };
}
