import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export interface UseInterruptedSessionReturn {
  interruptedSession: PersistedTrainingSession | null;
  resumeInterruptedSession: () => boolean;
  discardInterruptedSession: () => boolean;
}
