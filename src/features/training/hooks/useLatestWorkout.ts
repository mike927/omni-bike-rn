import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getLatestFinishedSession } from '../../../services/db/trainingSessionRepository';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export function useLatestWorkout(): PersistedTrainingSession | null {
  const [latestWorkout, setLatestWorkout] = useState<PersistedTrainingSession | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLatestWorkout(getLatestFinishedSession());
    }, []),
  );

  return latestWorkout;
}
