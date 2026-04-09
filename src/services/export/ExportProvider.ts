import type { PersistedTrainingSession, PersistedTrainingSample } from '../../types/sessionPersistence';

export interface ExportResult {
  success: boolean;
  externalId?: string;
  errorMessage?: string;
}

export interface ExportProvider {
  readonly name: string;
  readonly id: string;
  isConfigured(): boolean;
  exportSession(session: PersistedTrainingSession, samples: PersistedTrainingSample[]): Promise<ExportResult>;
}
