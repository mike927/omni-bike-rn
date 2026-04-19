import { saveWorkout } from '../health/appleHealthAdapter';
import { useAppleHealthConnectionStore } from '../../store/appleHealthConnectionStore';
import type { ExportProvider, ExportResult } from './ExportProvider';
import type { PersistedTrainingSession, PersistedTrainingSample } from '../../types/sessionPersistence';

const PROVIDER_ID = 'apple_health';
const PROVIDER_NAME = 'Apple Health';

export class AppleHealthExportProvider implements ExportProvider {
  readonly id = PROVIDER_ID;
  readonly name = PROVIDER_NAME;

  isConfigured(): boolean {
    return useAppleHealthConnectionStore.getState().connected;
  }

  async exportSession(session: PersistedTrainingSession, samples: PersistedTrainingSample[]): Promise<ExportResult> {
    if (!useAppleHealthConnectionStore.getState().connected) {
      return { success: false, errorMessage: 'Not connected to Apple Health.' };
    }

    try {
      const { workoutId } = await saveWorkout(session, samples);
      return { success: true, externalId: workoutId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save workout to Apple Health.';
      console.error('[AppleHealthExportProvider] Failed to save workout:', err);
      return { success: false, errorMessage: message };
    }
  }
}
