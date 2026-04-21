import type { KnownProviderId } from '../../../services/export/providerIds';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export interface WorkoutHistoryListItemProps {
  session: PersistedTrainingSession;
  uploadedProviderIds: readonly KnownProviderId[];
  onPress: () => void;
  onDelete: () => void;
}
