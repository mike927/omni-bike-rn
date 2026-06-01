import { getExportProvider } from './exportProviderRegistry';
import { getSessionById, getSamplesBySessionId } from '../db/trainingSessionRepository';
import {
  claimProviderUpload,
  getOrCreateProviderUpload,
  getProviderUpload,
  updateProviderUploadState,
} from '../db/providerUploadRepository';
import { getProviderGearLink, markProviderGearLinkStale } from '../providerGear/providerGearLinkStorage';
import type { GearReconcileOutcome } from './ExportProvider';

export interface UploadSessionResult {
  providerId: string;
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  warningMessage?: string;
}

async function applyGearReconciliation(
  sessionId: string,
  providerId: string,
  activityId: string,
  bikeId: string,
  reconcileGear: (activityId: string, gearId: string | null) => Promise<GearReconcileOutcome>,
): Promise<string | undefined> {
  const linkedGear = await getProviderGearLink(providerId, bikeId, 'bike');
  const outcome = await reconcileGear(activityId, linkedGear?.providerGearId ?? null);

  if (outcome.status !== 'warning') {
    return undefined;
  }

  if (outcome.linkInvalid) {
    try {
      await markProviderGearLinkStale(providerId, bikeId, 'bike');
    } catch (markError: unknown) {
      console.error(
        `[uploadOrchestrator] Failed to mark provider gear link stale for session "${sessionId}":`,
        markError,
      );
    }
  }

  return outcome.message;
}

export async function uploadSessionToProvider(sessionId: string, providerId: string): Promise<UploadSessionResult> {
  const provider = getExportProvider(providerId);
  if (!provider) {
    return { providerId, success: false, errorMessage: `Provider "${providerId}" is not registered.` };
  }

  if (!provider.isConfigured()) {
    return { providerId, success: false, errorMessage: `Provider "${providerId}" is not configured.` };
  }

  const session = getSessionById(sessionId);
  if (!session) {
    return { providerId, success: false, errorMessage: `Session "${sessionId}" not found.` };
  }

  if (session.status !== 'finished') {
    return { providerId, success: false, errorMessage: `Session "${sessionId}" is not finished.` };
  }

  const upload = getOrCreateProviderUpload({ sessionId, providerId });

  if (upload.uploadState === 'uploading') {
    return { providerId, success: false, errorMessage: 'Upload already in progress.' };
  }

  if (upload.uploadState === 'uploaded') {
    return { providerId, success: true, externalId: upload.externalId ?? undefined };
  }

  const claimedUpload = claimProviderUpload({ sessionId, providerId });
  if (!claimedUpload) {
    const latestUpload = getProviderUpload(sessionId, providerId);
    if (latestUpload?.uploadState === 'uploading') {
      return { providerId, success: false, errorMessage: 'Upload already in progress.' };
    }

    if (latestUpload?.uploadState === 'uploaded') {
      return { providerId, success: true, externalId: latestUpload.externalId ?? undefined };
    }

    return { providerId, success: false, errorMessage: 'Upload could not be started.' };
  }

  try {
    const samples = getSamplesBySessionId(sessionId);
    const result = await provider.exportSession(session, samples);

    if (result.success) {
      let warningMessage: string | undefined = result.warningMessage;

      if (result.externalId && session.savedBikeSnapshot && provider.reconcileGear) {
        warningMessage =
          (await applyGearReconciliation(
            sessionId,
            providerId,
            result.externalId,
            session.savedBikeSnapshot.id,
            provider.reconcileGear.bind(provider),
          )) ?? warningMessage;
      }

      updateProviderUploadState({
        sessionId,
        providerId,
        uploadState: 'uploaded',
        externalId: result.externalId ?? null,
        // Gear-reconciliation warnings are surfaced once via the return value but not stored
        // permanently, so the upload record stays clean and doesn't block future retries.
        errorMessage: null,
      });
      return { providerId, success: true, externalId: result.externalId, warningMessage };
    }

    updateProviderUploadState({
      sessionId,
      providerId,
      uploadState: 'failed',
      externalId: null,
      errorMessage: result.errorMessage ?? null,
    });
    return { providerId, success: false, errorMessage: result.errorMessage };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    console.error(`[uploadOrchestrator] Upload to "${providerId}" failed for session "${sessionId}":`, error);

    updateProviderUploadState({
      sessionId,
      providerId,
      uploadState: 'failed',
      externalId: null,
      errorMessage: message,
    });
    return { providerId, success: false, errorMessage: message };
  }
}
