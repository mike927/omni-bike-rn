import type { ExportProvider, ExportResult } from './ExportProvider';
import type { PersistedTrainingSession, PersistedTrainingSample } from '../../types/sessionPersistence';

const PROVIDER_ID = 'strava';
const PROVIDER_NAME = 'Strava';

/**
 * Strava export provider stub.
 *
 * Implements the {@link ExportProvider} contract. The actual Strava OAuth flow
 * and upload API integration will be added in Phase 6. For now this logs the
 * session summary and returns a success result so the rest of the export flow
 * can be developed and tested end-to-end.
 */
export class StravaExportProvider implements ExportProvider {
  readonly id = PROVIDER_ID;
  readonly name = PROVIDER_NAME;

  isConfigured(): boolean {
    // TODO: Phase 6 — return true when Strava OAuth tokens are present
    if (__DEV__) {
      return true;
    }

    return false;
  }

  async exportSession(_session: PersistedTrainingSession, _samples: PersistedTrainingSample[]): Promise<ExportResult> {
    // TODO: Phase 6 — implement Strava OAuth + TCX/FIT upload
    return { success: true };
  }
}
