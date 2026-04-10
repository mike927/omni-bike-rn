import { getExportProvider } from './exportProviderRegistry';
import { getSessionById, getSamplesBySessionId } from '../db/trainingSessionRepository';
import { getOrCreateProviderUpload, updateProviderUploadState } from '../db/providerUploadRepository';

export interface UploadSessionResult {
  providerId: string;
  success: boolean;
  externalId?: string;
  errorMessage?: string;
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

  updateProviderUploadState({ sessionId, providerId, uploadState: 'uploading', externalId: null, errorMessage: null });

  try {
    const samples = getSamplesBySessionId(sessionId);
    const result = await provider.exportSession(session, samples);

    if (result.success) {
      updateProviderUploadState({
        sessionId,
        providerId,
        uploadState: 'uploaded',
        externalId: result.externalId ?? null,
        errorMessage: null,
      });
      return { providerId, success: true, externalId: result.externalId };
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
