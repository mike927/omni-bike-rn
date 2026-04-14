import { useEffect, useRef } from 'react';

import {
  finalizeStaleOpenSessions,
  getLatestOpenSession,
  normalizeRecoveredSessionToPaused,
  STALE_SESSION_MAX_AGE_MS,
} from '../../../services/db/trainingSessionRepository';
import { useInterruptedSessionStore } from '../../../store/interruptedSessionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';

export function useInterruptedSessionRecovery(isEnabled: boolean): void {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isEnabled || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    if (useTrainingSessionStore.getState().phase !== TrainingPhase.Idle) {
      console.warn('[useInterruptedSessionRecovery] Skipping recovery because an in-memory session already exists.');
      return;
    }

    const finalizedSessions = finalizeStaleOpenSessions(Date.now(), STALE_SESSION_MAX_AGE_MS);
    if (finalizedSessions.length > 0) {
      console.warn(
        `[useInterruptedSessionRecovery] Auto-finalized ${finalizedSessions.length} stale interrupted session(s).`,
      );
    }

    const interruptedSession = getLatestOpenSession();
    if (!interruptedSession) {
      useInterruptedSessionStore.getState().clear();
      return;
    }

    if (interruptedSession.status === 'active') {
      const normalizedSession = normalizeRecoveredSessionToPaused(interruptedSession.id);
      if (!normalizedSession) {
        console.warn(
          '[useInterruptedSessionRecovery] Could not normalize active session to paused; skipping recovery.',
        );
        useInterruptedSessionStore.getState().clear();
        return;
      }
      useInterruptedSessionStore.getState().setInterruptedSession(normalizedSession);
      return;
    }

    useInterruptedSessionStore.getState().setInterruptedSession(interruptedSession);
  }, [isEnabled]);
}
