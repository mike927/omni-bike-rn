import type { ExportProvider, ExportResult } from './ExportProvider';
import { serializeSessionToTcx } from './formats/tcxSerializer';
import { getValidAccessToken } from '../strava/stravaAuthService';
import { attachStravaGearToActivity, clearStravaGearFromActivity, listStravaGear } from '../strava/stravaGearService';
import { uploadActivity, waitForProcessing } from '../strava/stravaApiClient';
import { STRAVA_CLIENT_ID } from '../strava/stravaConstants';
import { useStravaConnectionStore } from '../../store/stravaConnectionStore';
import type { GearType } from '../../types/gear';
import type { ProviderGearSummary } from '../../types/providerGear';
import type { PersistedTrainingSession, PersistedTrainingSample } from '../../types/sessionPersistence';

const PROVIDER_ID = 'strava';
const PROVIDER_NAME = 'Strava';

function buildActivityName(session: PersistedTrainingSession): string {
  const date = new Date(session.startedAtMs);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Indoor Cycling \u2014 ${formatted}`;
}

export class StravaExportProvider implements ExportProvider {
  readonly id = PROVIDER_ID;
  readonly name = PROVIDER_NAME;

  isConfigured(): boolean {
    if (!STRAVA_CLIENT_ID) {
      return false;
    }
    return useStravaConnectionStore.getState().connected;
  }

  async exportSession(session: PersistedTrainingSession, samples: PersistedTrainingSample[]): Promise<ExportResult> {
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get Strava access token.';
      console.error('[StravaExportProvider] Failed to get access token:', err);
      return { success: false, errorMessage: message };
    }

    const tcxData = serializeSessionToTcx(session, samples);
    const activityName = buildActivityName(session);
    const externalId = `${session.id}.tcx`;

    let uploadResponse;
    try {
      uploadResponse = await uploadActivity(accessToken, tcxData, activityName, externalId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload activity to Strava.';
      console.error('[StravaExportProvider] Upload request failed:', err);
      return { success: false, errorMessage: message };
    }

    let result;
    try {
      result = await waitForProcessing(accessToken, uploadResponse.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to poll Strava upload status.';
      console.error('[StravaExportProvider] Processing poll failed:', err);
      return { success: false, errorMessage: message };
    }

    if (result.error) {
      return { success: false, errorMessage: result.error };
    }

    return {
      success: true,
      externalId: result.activityId === null ? undefined : String(result.activityId),
    };
  }

  async listAvailableGear(gearType: GearType): Promise<ProviderGearSummary[]> {
    return listStravaGear(gearType);
  }

  async attachGearToActivity(activityId: string, providerGearId: string): Promise<void> {
    await attachStravaGearToActivity(activityId, providerGearId);
  }

  async clearGearFromActivity(activityId: string): Promise<void> {
    await clearStravaGearFromActivity(activityId);
  }
}
