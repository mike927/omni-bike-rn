import { getExportProvider } from './exportProviderRegistry';
import { getSessionById, getSamplesBySessionId } from '../db/trainingSessionRepository';
import {
  claimInterruptedProviderUpload,
  claimProviderUpload,
  getOrCreateProviderUpload,
  getProviderUpload,
  markInterruptedProviderUploadAcknowledged,
  markProviderUploadInterrupted,
  updateProviderUploadState,
} from '../db/providerUploadRepository';
import { getProviderGearLink, markProviderGearLinkStale } from '../providerGear/providerGearLinkStorage';
import type { ExportProvider, GearReconcileOutcome } from './ExportProvider';
import type { PersistedProviderUpload, PersistedTrainingSession } from '../../types/sessionPersistence';

export interface UploadSessionResult {
  providerId: string;
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  warningMessage?: string;
  /**
   * A previous attempt was interrupted before the app learned its outcome, so the
   * app cannot tell whether the provider already has this ride. The caller must
   * let the user settle it: {@link resendInterruptedUpload} or
   * {@link acknowledgeInterruptedUpload}. Never resolved by guessing here.
   */
  needsInterruptionDecision?: boolean;
}

const UPLOAD_IN_PROGRESS_MESSAGE = 'Upload already in progress.';
const UPLOAD_NOT_STARTED_MESSAGE = 'Upload could not be started.';

/**
 * Keys of the uploads this process is currently running. A persisted `uploading`
 * row is only trustworthy while its key is in here: anything else was left behind
 * by a process that was killed, which is a different situation with a different
 * recovery. This is deliberately not a job queue, just the liveness fact the
 * persisted state cannot carry across a launch.
 */
const liveUploads = new Set<string>();

function liveUploadKey(sessionId: string, providerId: string): string {
  return `${sessionId}::${providerId}`;
}

function interruptionNotice(providerName: string): string {
  return `The last upload to ${providerName} was interrupted before it finished, so the app cannot tell whether ${providerName} already has this ride.`;
}

function interruptionDecision(providerId: string, providerName: string): UploadSessionResult {
  return {
    providerId,
    success: false,
    errorMessage: interruptionNotice(providerName),
    needsInterruptionDecision: true,
  };
}

function describeUpload(
  providerId: string,
  providerName: string,
  upload: PersistedProviderUpload | null,
): UploadSessionResult {
  if (upload?.uploadState === 'uploaded') {
    return { providerId, success: true, externalId: upload.externalId ?? undefined };
  }

  if (upload?.uploadState === 'uploading') {
    return { providerId, success: false, errorMessage: UPLOAD_IN_PROGRESS_MESSAGE };
  }

  if (upload?.uploadState === 'interrupted') {
    return interruptionDecision(providerId, providerName);
  }

  return { providerId, success: false, errorMessage: UPLOAD_NOT_STARTED_MESSAGE };
}

interface UploadContext {
  provider: ExportProvider;
  session: PersistedTrainingSession;
}

type UploadContextResult = { ok: true; context: UploadContext } | { ok: false; result: UploadSessionResult };

function resolveUploadContext(sessionId: string, providerId: string): UploadContextResult {
  const provider = getExportProvider(providerId);
  if (!provider) {
    return {
      ok: false,
      result: { providerId, success: false, errorMessage: `Provider "${providerId}" is not registered.` },
    };
  }

  if (!provider.isConfigured()) {
    return {
      ok: false,
      result: { providerId, success: false, errorMessage: `Provider "${providerId}" is not configured.` },
    };
  }

  const session = getSessionById(sessionId);
  if (!session) {
    return { ok: false, result: { providerId, success: false, errorMessage: `Session "${sessionId}" not found.` } };
  }

  if (session.status !== 'finished') {
    return {
      ok: false,
      result: { providerId, success: false, errorMessage: `Session "${sessionId}" is not finished.` },
    };
  }

  return { ok: true, context: { provider, session } };
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

/**
 * Runs a claimed upload. The row is already `uploading`; registering the key here
 * is what lets a later call tell this live operation apart from an abandoned row,
 * and the `finally` is what stops a crashed attempt from looking live forever.
 */
async function runClaimedUpload(
  sessionId: string,
  providerId: string,
  { provider, session }: UploadContext,
): Promise<UploadSessionResult> {
  const key = liveUploadKey(sessionId, providerId);
  liveUploads.add(key);

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
  } finally {
    liveUploads.delete(key);
  }
}

export async function uploadSessionToProvider(sessionId: string, providerId: string): Promise<UploadSessionResult> {
  const contextResult = resolveUploadContext(sessionId, providerId);
  if (!contextResult.ok) {
    return contextResult.result;
  }

  const { context } = contextResult;
  const providerName = context.provider.name;
  let upload = getOrCreateProviderUpload({ sessionId, providerId });

  if (upload.uploadState === 'uploaded') {
    return { providerId, success: true, externalId: upload.externalId ?? undefined };
  }

  if (upload.uploadState === 'uploading' && !liveUploads.has(liveUploadKey(sessionId, providerId))) {
    // Nothing in this process owns the row, so the attempt died with an earlier
    // launch. Whether the provider accepted the ride is genuinely unknown, and
    // guessing either way is a duplicate activity or a lost ride.
    upload = markProviderUploadInterrupted({ sessionId, providerId }) ?? upload;
  }

  if (upload.uploadState === 'uploading') {
    return { providerId, success: false, errorMessage: UPLOAD_IN_PROGRESS_MESSAGE };
  }

  if (upload.uploadState === 'interrupted') {
    return interruptionDecision(providerId, providerName);
  }

  const claimedUpload = claimProviderUpload({ sessionId, providerId });
  if (!claimedUpload) {
    return describeUpload(providerId, providerName, getProviderUpload(sessionId, providerId));
  }

  return runClaimedUpload(sessionId, providerId, context);
}

/**
 * Sends an interrupted attempt again, after the user has checked the provider and
 * accepted that a duplicate is possible. Never called on the app's own initiative.
 */
export async function resendInterruptedUpload(sessionId: string, providerId: string): Promise<UploadSessionResult> {
  const contextResult = resolveUploadContext(sessionId, providerId);
  if (!contextResult.ok) {
    return contextResult.result;
  }

  const { context } = contextResult;
  const claimedUpload = claimInterruptedProviderUpload({ sessionId, providerId });
  if (!claimedUpload) {
    return describeUpload(providerId, context.provider.name, getProviderUpload(sessionId, providerId));
  }

  return runClaimedUpload(sessionId, providerId, context);
}

/**
 * Records the user's answer that the provider already has this ride. Local
 * bookkeeping only: it settles the uncertainty without touching the provider.
 */
export function acknowledgeInterruptedUpload(sessionId: string, providerId: string): UploadSessionResult {
  const acknowledged = markInterruptedProviderUploadAcknowledged({ sessionId, providerId });
  if (acknowledged) {
    return { providerId, success: true, externalId: acknowledged.externalId ?? undefined };
  }

  const latestUpload = getProviderUpload(sessionId, providerId);
  if (latestUpload?.uploadState === 'uploaded') {
    return { providerId, success: true, externalId: latestUpload.externalId ?? undefined };
  }

  return { providerId, success: false, errorMessage: 'This upload is no longer waiting on a decision.' };
}
