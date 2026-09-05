import { router } from 'expo-router';

import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../types/training';
import { resolvePostFinishRoute } from '../navigation/trainingSummaryRoute';
import { finishSessionAndDisconnect, pauseSession, resumeSession } from '../sessionController';
import { useWatchRemoteControl } from './useWatchRemoteControl';

/**
 * Root-owned binding of the wrist remote to the session commands.
 *
 * The Watch drives the ride, not a screen: its Pause / Resume / End are the same
 * global commands the on-screen controls issue, and they must keep working when
 * the Training dashboard is not mounted (the user pressed Back while the ride,
 * and the Watch workout, carried on). So this is mounted from
 * `useTrainingSessionLifecycle`, once, next to the recording clock and the
 * bike-status observer. Never mount it from a screen.
 *
 * Phase guards live in the commands, so a stray request is a safe no-op.
 */
export function useWatchRideRemote(): void {
  useWatchRemoteControl({
    onPause: pauseSession,
    onResume: resumeSession,
    onFinish: finishRideFromWatch,
  });
}

/**
 * End the ride from the wrist and show its summary, mirroring the screen's
 * Finish button. Navigation is imperative because the owner is the app root,
 * not the screen that happens to be on top.
 */
async function finishRideFromWatch(): Promise<void> {
  const phase = useTrainingSessionStore.getState().phase;
  if (phase !== TrainingPhase.Active && phase !== TrainingPhase.Paused) {
    // Nothing to finish: do not yank the user off whatever screen they are on.
    return;
  }

  try {
    const sessionId = await finishSessionAndDisconnect();
    router.replace(resolvePostFinishRoute(sessionId));
  } catch (err: unknown) {
    console.error('[useWatchRideRemote] Finish from the Watch failed:', err);
  }
}
