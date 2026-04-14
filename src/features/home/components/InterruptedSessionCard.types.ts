import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export interface InterruptedSessionCardProps {
  session: PersistedTrainingSession;
  onResume: () => void;
  onDiscard: () => void;
}
