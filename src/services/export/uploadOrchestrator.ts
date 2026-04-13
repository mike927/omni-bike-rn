import { getExportProvider } from './exportProviderRegistry';
import { getSessionById, getSamplesBySessionId } from '../db/trainingSessionRepository';
import { STRAVA_RECONNECT_ERROR_MARKER } from '../strava/stravaConstants';
import {
  claimProviderUpload,
  getOrCreateProviderUpload,
  getProviderUpload,
  updateProviderUploadState,
} from '../db/providerUploadRepository';
import { getProviderGearLink, markProviderGearLinkStale } from '../providerGear/providerGearLinkStorage';

export interface UploadSessionResult {
  providerId: string;
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  warningMessage?: string;
}

function shouldMarkLinkedGearStale(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('"resource":"activity"') || lowerMessage.includes('private activity edit access')) {
    return false;
  }

  return (
    lowerMessage.includes('"resource":"gear"') ||
    lowerMessage.includes('gear_id') ||
    lowerMessage.includes('gear not found')
  );
}

function logProviderGearAttach(message: string, payload: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }

  console.warn(`[uploadOrchestrator] ${message}`, payload);
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
      let warningMessage: string | undefined;

      if (result.externalId && session.savedBikeSnapshot) {
        const linkedGear = await getProviderGearLink(providerId, session.savedBikeSnapshot.id, 'bike');

        if (linkedGear && provider.attachGearToActivity) {
          logProviderGearAttach('Found linked provider gear for upload', {
            providerId,
            sessionId,
            activityId: result.externalId,
            localBikeId: session.savedBikeSnapshot.id,
            providerGearId: linkedGear.providerGearId,
            providerGearName: linkedGear.providerGearName,
          });

          try {
            await provider.attachGearToActivity(result.externalId, linkedGear.providerGearId);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to attach provider gear.';
            console.error(
              `[uploadOrchestrator] Upload to "${providerId}" succeeded but provider gear attach failed for session "${sessionId}":`,
              error,
            );

            if (shouldMarkLinkedGearStale(message)) {
              try {
                await markProviderGearLinkStale(providerId, session.savedBikeSnapshot.id, 'bike');
              } catch (markError: unknown) {
                console.error(
                  `[uploadOrchestrator] Failed to mark provider gear link stale for session "${sessionId}":`,
                  markError,
                );
              }
            }

            warningMessage = message.includes(STRAVA_RECONNECT_ERROR_MARKER)
              ? 'Workout uploaded, but Strava could not attach the linked bike. Reconnect Strava once, then try again.'
              : 'Workout uploaded, but the linked bike could not be attached. Relink it in Settings.';
          }
        } else if (!linkedGear && provider.clearGearFromActivity) {
          logProviderGearAttach('No linked provider gear found; clearing provider gear from uploaded activity', {
            providerId,
            sessionId,
            activityId: result.externalId,
            localBikeId: session.savedBikeSnapshot.id,
          });

          try {
            await provider.clearGearFromActivity(result.externalId);
            logProviderGearAttach('Cleared provider gear from uploaded activity', {
              providerId,
              sessionId,
              activityId: result.externalId,
              localBikeId: session.savedBikeSnapshot.id,
            });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to clear provider gear.';
            console.error(
              `[uploadOrchestrator] Upload to "${providerId}" succeeded but clearing provider gear failed for session "${sessionId}":`,
              error,
            );

            warningMessage = message.includes(STRAVA_RECONNECT_ERROR_MARKER)
              ? 'Workout uploaded, but Strava could not clear its default bike. Reconnect Strava once, then try again.'
              : 'Workout uploaded, but Strava may still apply its default bike. Check your Strava gear settings.';
          }
        } else if (!linkedGear) {
          logProviderGearAttach('No linked provider gear found; provider does not support explicit gear clearing', {
            providerId,
            sessionId,
            activityId: result.externalId,
            localBikeId: session.savedBikeSnapshot.id,
          });
        }
      }

      updateProviderUploadState({
        sessionId,
        providerId,
        uploadState: 'uploaded',
        externalId: result.externalId ?? null,
        errorMessage: warningMessage ?? null,
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
