import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getLatestFinishedSession } from '../../../services/db/trainingSessionRepository';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export function useLatestWorkout(): PersistedTrainingSession | null {
  const [latestWorkout, setLatestWorkout] = useState<PersistedTrainingSession | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setLatestWorkout(getLatestFinishedSession());
      } catch (err: unknown) {
        // Never crash the Home screen on a failed read — show no latest workout.
        console.error('[useLatestWorkout] Failed to read latest workout:', err);
        setLatestWorkout(null);
      }
    }, []),
  );

  return latestWorkout;
}
