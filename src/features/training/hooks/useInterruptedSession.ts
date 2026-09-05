import { useCallback } from 'react';

import { discardDraftSession, getLastSampleSequence } from '../../../services/db/trainingSessionRepository';
import { useInterruptedSessionStore } from '../../../store/interruptedSessionStore';
import type { TrainingSessionRestoreInput } from '../../../types/training';
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

    const lastSampleSequence = getLastSampleSequence(interruptedSession.id);

    // Restore first, seed after, and let `restoreSession` be the only gate. It
    // already refuses anything but an Idle phase, so a second copy of that check
    // here would only hide the ordering that matters: handing the persistence
    // hook the interrupted ride's identity before the guard has passed points
    // every later write at that row while a different ride is in memory.
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
