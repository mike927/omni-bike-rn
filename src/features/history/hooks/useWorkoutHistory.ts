import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getProviderUploadsBySessionId } from '../../../services/db/providerUploadRepository';
import { deleteSession, getFinishedSessions } from '../../../services/db/trainingSessionRepository';
import { KNOWN_PROVIDER_DISPLAY_ORDER, type KnownProviderId } from '../../../services/export/providerIds';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';
import type { HistoryListItem } from './useWorkoutHistory.types';

function deriveUploadedProviderIds(session: PersistedTrainingSession): readonly KnownProviderId[] {
  const uploads = getProviderUploadsBySessionId(session.id);
  const uploadedSet = new Set<string>(
    uploads.filter((upload) => upload.uploadState === 'uploaded').map((upload) => upload.providerId),
  );
  return KNOWN_PROVIDER_DISPLAY_ORDER.filter((providerId) => uploadedSet.has(providerId));
}

function buildHistoryItems(sessions: PersistedTrainingSession[]): HistoryListItem[] {
  return sessions.map((session) => ({
    session,
    uploadedProviderIds: deriveUploadedProviderIds(session),
  }));
}

export function useWorkoutHistory() {
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(() => {
    setIsLoading(true);
    try {
      setItems(buildHistoryItems(getFinishedSessions()));
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

  return { items, isLoading, refresh: fetchSessions, deleteWorkout };
}
