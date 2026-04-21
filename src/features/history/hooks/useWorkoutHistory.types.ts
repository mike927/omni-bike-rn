import type { KnownProviderId } from '../../../services/export/providerIds';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export interface HistoryListItem {
  session: PersistedTrainingSession;
  uploadedProviderIds: readonly KnownProviderId[];
}
