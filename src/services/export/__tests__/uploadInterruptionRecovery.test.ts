import { acknowledgeInterruptedUpload, resendInterruptedUpload, uploadSessionToProvider } from '../uploadOrchestrator';
import { getExportProvider } from '../exportProviderRegistry';
import { getSamplesBySessionId, getSessionById } from '../../db/trainingSessionRepository';
import {
  claimInterruptedProviderUpload,
  claimProviderUpload,
  getOrCreateProviderUpload,
  getProviderUpload,
  markInterruptedProviderUploadAcknowledged,
  markProviderUploadInterrupted,
  updateProviderUploadState,
} from '../../db/providerUploadRepository';

import type { ExportProvider } from '../ExportProvider';
import type {
  CreateProviderUploadInput,
  PersistedProviderUpload,
  SessionUploadState,
  UpdateProviderUploadStateInput,
} from '../../../types/sessionPersistence';

jest.mock('../exportProviderRegistry', () => ({
  getExportProvider: jest.fn(),
}));

jest.mock('../../db/trainingSessionRepository', () => ({
  getSessionById: jest.fn(),
  getSamplesBySessionId: jest.fn(),
}));

jest.mock('../../db/providerUploadRepository', () => ({
  claimInterruptedProviderUpload: jest.fn(),
  claimProviderUpload: jest.fn(),
  getOrCreateProviderUpload: jest.fn(),
  getProviderUpload: jest.fn(),
  markInterruptedProviderUploadAcknowledged: jest.fn(),
  markProviderUploadInterrupted: jest.fn(),
  updateProviderUploadState: jest.fn(),
}));

jest.mock('../../providerGear/providerGearLinkStorage', () => ({
  getProviderGearLink: jest.fn().mockResolvedValue(null),
  markProviderGearLinkStale: jest.fn().mockResolvedValue(undefined),
}));

const SESSION_ID = 'session-1';
const PROVIDER_ID = 'strava';

const FINISHED_SESSION = {
  id: SESSION_ID,
  status: 'finished' as const,
  startedAtMs: 1000,
  endedAtMs: 2000,
  elapsedSeconds: 60,
  totalDistanceMeters: 500,
  totalCaloriesKcal: 10,
  currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: 500 },
  savedBikeSnapshot: null,
  savedHrSnapshot: null,
  uploadState: 'ready' as const,
  createdAtMs: 1000,
  updatedAtMs: 2000,
};

/**
 * In-memory stand-in for `session_provider_uploads`. The upload state machine is
 * the thing under test, so the rows have to behave like rows: every transition
 * is conditional on the current state, exactly as the SQL is.
 */
const table = new Map<string, PersistedProviderUpload>();

function rowKey(sessionId: string, providerId: string): string {
  return `${sessionId}::${providerId}`;
}

function seedRow(uploadState: SessionUploadState, externalId: string | null = null): void {
  table.set(rowKey(SESSION_ID, PROVIDER_ID), {
    id: 'upload-1',
    sessionId: SESSION_ID,
    providerId: PROVIDER_ID,
    uploadState,
    externalId,
    errorMessage: null,
    createdAtMs: 1,
    updatedAtMs: 1,
  });
}

function persistedState(): SessionUploadState | null {
  return table.get(rowKey(SESSION_ID, PROVIDER_ID))?.uploadState ?? null;
}

function transition(
  input: CreateProviderUploadInput,
  allowedStates: readonly SessionUploadState[],
  nextState: SessionUploadState,
): PersistedProviderUpload | null {
  const key = rowKey(input.sessionId, input.providerId);
  const row = table.get(key);
  if (!row || !allowedStates.includes(row.uploadState)) {
    return null;
  }
  const next: PersistedProviderUpload = { ...row, uploadState: nextState, updatedAtMs: row.updatedAtMs + 1 };
  table.set(key, next);
  return { ...next };
}

function wireRepository(): void {
  (getOrCreateProviderUpload as jest.Mock).mockImplementation((input: CreateProviderUploadInput) => {
    const key = rowKey(input.sessionId, input.providerId);
    const existing = table.get(key);
    if (existing) return { ...existing };
    const created: PersistedProviderUpload = {
      id: 'upload-created',
      sessionId: input.sessionId,
      providerId: input.providerId,
      uploadState: 'ready',
      externalId: null,
      errorMessage: null,
      createdAtMs: 1,
      updatedAtMs: 1,
    };
    table.set(key, created);
    return { ...created };
  });

  (getProviderUpload as jest.Mock).mockImplementation((sessionId: string, providerId: string) => {
    const row = table.get(rowKey(sessionId, providerId));
    return row ? { ...row } : null;
  });

  (claimProviderUpload as jest.Mock).mockImplementation((input: CreateProviderUploadInput) =>
    transition(input, ['ready', 'failed'], 'uploading'),
  );

  (claimInterruptedProviderUpload as jest.Mock).mockImplementation((input: CreateProviderUploadInput) =>
    transition(input, ['interrupted'], 'uploading'),
  );

  (markProviderUploadInterrupted as jest.Mock).mockImplementation((input: CreateProviderUploadInput) =>
    transition(input, ['uploading'], 'interrupted'),
  );

  (markInterruptedProviderUploadAcknowledged as jest.Mock).mockImplementation((input: CreateProviderUploadInput) =>
    transition(input, ['interrupted'], 'uploaded'),
  );

  (updateProviderUploadState as jest.Mock).mockImplementation((input: UpdateProviderUploadStateInput) => {
    const key = rowKey(input.sessionId, input.providerId);
    const row = table.get(key);
    if (!row) return;
    table.set(key, {
      ...row,
      uploadState: input.uploadState,
      externalId: input.externalId,
      errorMessage: input.errorMessage,
      updatedAtMs: row.updatedAtMs + 1,
    });
  });
}

function createProvider(overrides?: Partial<ExportProvider>): ExportProvider {
  return {
    id: PROVIDER_ID,
    name: 'Strava',
    isConfigured: () => true,
    exportSession: jest.fn().mockResolvedValue({ success: true, externalId: 'ext-123' }),
    ...overrides,
  };
}

function useProvider(provider: ExportProvider): jest.Mock {
  (getExportProvider as jest.Mock).mockReturnValue(provider);
  return provider.exportSession as jest.Mock;
}

describe('interrupted upload recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    table.clear();
    wireRepository();
    (getSessionById as jest.Mock).mockReturnValue(FINISHED_SESSION);
    (getSamplesBySessionId as jest.Mock).mockReturnValue([]);
  });

  it('treats an uploading row no live operation owns as an interrupted attempt', async () => {
    const exportSession = useProvider(createProvider());
    seedRow('uploading');

    const result = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(result.success).toBe(false);
    expect(result.needsInterruptionDecision).toBe(true);
    // The exact sentence the summary screen puts in front of the user. Asserted here,
    // against the real function, so the copy cannot drift behind a screen-level mock.
    expect(result.errorMessage).toBe(
      'The last upload to Strava was interrupted before it finished, so the app cannot tell whether Strava already has this ride.',
    );
    expect(persistedState()).toBe('interrupted');
    expect(exportSession).not.toHaveBeenCalled();
  });

  it('keeps an upload that is live in this process exclusive to its own operation', async () => {
    // Assigned synchronously by the Promise executor below, before anything can call it.
    let releaseExport!: (value: { success: boolean; externalId: string }) => void;
    const exportSession = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        releaseExport = resolve;
      }),
    );
    useProvider(createProvider({ exportSession }));
    seedRow('ready');

    const inFlight = uploadSessionToProvider(SESSION_ID, PROVIDER_ID);
    const concurrent = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(concurrent.success).toBe(false);
    expect(concurrent.errorMessage).toBe('Upload already in progress.');
    expect(concurrent.needsInterruptionDecision).toBeUndefined();
    expect(persistedState()).toBe('uploading');

    releaseExport({ success: true, externalId: 'ext-123' });

    await expect(inFlight).resolves.toEqual({ providerId: PROVIDER_ID, success: true, externalId: 'ext-123' });
    expect(exportSession).toHaveBeenCalledTimes(1);
    expect(persistedState()).toBe('uploaded');
  });

  it('never resends an interrupted attempt without an explicit decision', async () => {
    const exportSession = useProvider(createProvider());
    seedRow('interrupted');

    const result = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(result.needsInterruptionDecision).toBe(true);
    expect(exportSession).not.toHaveBeenCalled();
    expect(persistedState()).toBe('interrupted');
  });

  it('converges an interruption before submission to a fresh upload when the user resends', async () => {
    const exportSession = useProvider(createProvider());
    seedRow('uploading');

    await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);
    const resent = await resendInterruptedUpload(SESSION_ID, PROVIDER_ID);

    expect(resent).toEqual({ providerId: PROVIDER_ID, success: true, externalId: 'ext-123' });
    expect(exportSession).toHaveBeenCalledTimes(1);
    expect(persistedState()).toBe('uploaded');
  });

  it('converges an interruption after remote success to uploaded without a second export', async () => {
    const exportSession = useProvider(createProvider());
    seedRow('uploading');

    const pending = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);
    const acknowledged = acknowledgeInterruptedUpload(SESSION_ID, PROVIDER_ID);

    expect(pending.needsInterruptionDecision).toBe(true);
    expect(acknowledged.success).toBe(true);
    expect(persistedState()).toBe('uploaded');
    expect(exportSession).not.toHaveBeenCalled();
  });

  it('refuses to resend once the attempt is no longer waiting on a decision', async () => {
    const exportSession = useProvider(createProvider());
    seedRow('uploaded', 'ext-9');

    const result = await resendInterruptedUpload(SESSION_ID, PROVIDER_ID);

    expect(result).toEqual({
      providerId: PROVIDER_ID,
      success: true,
      externalId: 'ext-9',
      alreadyUploaded: true,
    });
    expect(exportSession).not.toHaveBeenCalled();
  });

  it('retries a failed upload directly, with no interruption decision', async () => {
    const exportSession = useProvider(createProvider());
    seedRow('failed');

    const result = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(result.success).toBe(true);
    expect(result.needsInterruptionDecision).toBeUndefined();
    expect(exportSession).toHaveBeenCalledTimes(1);
  });

  it('releases the live operation when the export throws so the next retry can claim it', async () => {
    const exportSession = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({ success: true, externalId: 'ext-123' });
    useProvider(createProvider({ exportSession }));
    seedRow('ready');

    const failure = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);
    const retry = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(failure.success).toBe(false);
    expect(retry.success).toBe(true);
    expect(retry.needsInterruptionDecision).toBeUndefined();
    expect(exportSession).toHaveBeenCalledTimes(2);
  });
  it('keeps a resend that fails waiting on a decision instead of demoting it to an ordinary failure', async () => {
    const exportSession = jest.fn().mockResolvedValue({ success: false, errorMessage: 'Rate limited' });
    useProvider(createProvider({ exportSession }));
    seedRow('interrupted');

    const resent = await resendInterruptedUpload(SESSION_ID, PROVIDER_ID);

    expect(resent.success).toBe(false);
    expect(resent.errorMessage).toBe('Rate limited');
    // A resend failing says nothing about whether the *earlier* attempt reached the
    // provider, so the uncertainty has to survive it.
    expect(persistedState()).toBe('interrupted');

    // And the ordinary retry path must still refuse to send it without a decision.
    const next = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(next.needsInterruptionDecision).toBe(true);
    expect(exportSession).toHaveBeenCalledTimes(1);
  });

  it('keeps a resend that throws waiting on a decision', async () => {
    const exportSession = jest.fn().mockRejectedValue(new Error('Network timeout'));
    useProvider(createProvider({ exportSession }));
    seedRow('interrupted');

    const resent = await resendInterruptedUpload(SESSION_ID, PROVIDER_ID);

    expect(resent.success).toBe(false);
    expect(resent.errorMessage).toBe('Network timeout');
    expect(persistedState()).toBe('interrupted');

    const next = await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(next.needsInterruptionDecision).toBe(true);
    expect(exportSession).toHaveBeenCalledTimes(1);
  });

  it('reports an ordinary failure as failed, so a plain retry is still offered', async () => {
    const exportSession = jest.fn().mockResolvedValue({ success: false, errorMessage: 'Rate limited' });
    useProvider(createProvider({ exportSession }));
    seedRow('ready');

    await uploadSessionToProvider(SESSION_ID, PROVIDER_ID);

    expect(persistedState()).toBe('failed');
  });

  it('treats a repeated "already there" answer as settled rather than an error', () => {
    seedRow('interrupted');

    const first = acknowledgeInterruptedUpload(SESSION_ID, PROVIDER_ID);
    const second = acknowledgeInterruptedUpload(SESSION_ID, PROVIDER_ID);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.errorMessage).toBeUndefined();
    expect(persistedState()).toBe('uploaded');
  });

  it('reports that nothing is waiting on a decision when the attempt has moved on', () => {
    seedRow('uploading');

    const result = acknowledgeInterruptedUpload(SESSION_ID, PROVIDER_ID);

    expect(result).toEqual({
      providerId: PROVIDER_ID,
      success: false,
      errorMessage: 'This upload is no longer waiting on a decision.',
    });
    expect(persistedState()).toBe('uploading');
  });
});
