import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { deleteSession, getFinishedSessions } from '../../../services/db/trainingSessionRepository';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export function useWorkoutHistory() {
  const [sessions, setSessions] = useState<PersistedTrainingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(() => {
    setIsLoading(true);
    try {
      setSessions(getFinishedSessions());
    } catch (err: unknown) {
      console.error('[useWorkoutHistory] Failed to fetch sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [fetchSessions]),
  );

  const deleteWorkout = useCallback(
    (sessionId: string) => {
      try {
        deleteSession(sessionId);
        fetchSessions();
      } catch (err: unknown) {
        console.error('[useWorkoutHistory] Failed to delete session:', err);
      }
    },
    [fetchSessions],
  );

  return { sessions, isLoading, refresh: fetchSessions, deleteWorkout };
}
