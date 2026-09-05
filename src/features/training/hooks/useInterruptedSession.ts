import { useCallback } from 'react';

import { discardDraftSession, getLastSampleSequence } from '../../../services/db/trainingSessionRepository';
import { useInterruptedSessionStore } from '../../../store/interruptedSessionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase, type TrainingSessionRestoreInput } from '../../../types/training';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';
import { restoreSession } from '../sessionController';
import { seedFromPersistedSession } from './useTrainingSessionPersistence';
import type { UseInterruptedSessionReturn } from './InterruptedSessionTypes';

function toRestoreInput(session: PersistedTrainingSession): TrainingSessionRestoreInput {
  return {
    elapsedSeconds: session.elapsedSeconds,
    totalDistance: session.totalDistanceMeters,
    totalCalories: session.totalCaloriesKcal,
    currentMetrics: session.currentMetrics,
  };
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

    // Restore first, seed after. The controller's own Idle guard is the last word
    // on whether this ride may come back, so handing the persistence hook the
    // restored ride's identity before that guard has passed would leave the app
    // writing into the interrupted row while a different ride is in memory.
    if (!restoreSession(toRestoreInput(interruptedSession))) {
      return false;
    }

    seedFromPersistedSession(interruptedSession.id, lastSampleSequence);
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
