import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';

const KEEP_AWAKE_TAG = 'omni-bike-training';

/**
 * Root-only hook that prevents iPhone auto-lock while a ride is in progress.
 * Without this the screen dims and locks mid-workout, freezing the HR and
 * speed tiles — the user has to tap to see their current metrics.
 *
 * Active while phase is Active or Paused so a paused ride (waiting to resume
 * from a bike stop or manual pause) also keeps the dashboard readable.
 */
export function useKeepAwakeDuringTraining(): void {
  const phase = useTrainingSessionStore((s) => s.phase);

  useEffect(() => {
    const isInSession = phase === TrainingPhase.Active || phase === TrainingPhase.Paused;
    if (!isInSession) return;

    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [phase]);
}
