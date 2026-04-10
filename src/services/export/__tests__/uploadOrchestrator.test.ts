import { uploadSessionToProvider } from '../uploadOrchestrator';
import { getExportProvider } from '../exportProviderRegistry';
import { getSessionById, getSamplesBySessionId } from '../../db/trainingSessionRepository';
import {
  claimProviderUpload,
  getOrCreateProviderUpload,
  getProviderUpload,
  updateProviderUploadState,
} from '../../db/providerUploadRepository';

import type { ExportProvider } from '../ExportProvider';
import type { PersistedProviderUpload } from '../../../types/sessionPersistence';

jest.mock('../exportProviderRegistry', () => ({
  getExportProvider: jest.fn(),
}));

jest.mock('../../db/trainingSessionRepository', () => ({
  getSessionById: jest.fn(),
  getSamplesBySessionId: jest.fn(),
}));

jest.mock('../../db/providerUploadRepository', () => ({
  claimProviderUpload: jest.fn(),
  getOrCreateProviderUpload: jest.fn(),
  getProviderUpload: jest.fn(),
  updateProviderUploadState: jest.fn(),
}));

const mockGetExportProvider = getExportProvider as jest.MockedFunction<typeof getExportProvider>;
const mockGetSessionById = getSessionById as jest.MockedFunction<typeof getSessionById>;
const mockGetSamplesBySessionId = getSamplesBySessionId as jest.MockedFunction<typeof getSamplesBySessionId>;
const mockClaimProviderUpload = claimProviderUpload as jest.MockedFunction<typeof claimProviderUpload>;
const mockGetOrCreateProviderUpload = getOrCreateProviderUpload as jest.MockedFunction<
  typeof getOrCreateProviderUpload
>;
const mockGetProviderUpload = getProviderUpload as jest.MockedFunction<typeof getProviderUpload>;
const mockUpdateProviderUploadState = updateProviderUploadState as jest.MockedFunction<
  typeof updateProviderUploadState
>;

const FINISHED_SESSION = {
  id: 'session-1',
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

const READY_UPLOAD: PersistedProviderUpload = {
  id: 'upload-1',
  sessionId: 'session-1',
  providerId: 'strava',
  uploadState: 'ready',
  externalId: null,
  errorMessage: null,
  createdAtMs: 3000,
  updatedAtMs: 3000,
};

function createMockProvider(overrides?: Partial<ExportProvider>): ExportProvider {
  return {
    id: 'strava',
    name: 'Strava',
    isConfigured: () => true,
    exportSession: jest.fn().mockResolvedValue({ success: true, externalId: 'ext-123' }),
    ...overrides,
  };
}

describe('uploadOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads successfully and transitions state through uploading to uploaded', async () => {
    const provider = createMockProvider();
    mockGetExportProvider.mockReturnValue(provider);
    mockGetSessionById.mockReturnValue(FINISHED_SESSION);
    mockGetOrCreateProviderUpload.mockReturnValue(READY_UPLOAD);
    mockClaimProviderUpload.mockReturnValue({ ...READY_UPLOAD, uploadState: 'uploading' });
    mockGetSamplesBySessionId.mockReturnValue([]);

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result).toEqual({ providerId: 'strava', success: true, externalId: 'ext-123' });
    expect(mockClaimProviderUpload).toHaveBeenCalledWith({ sessionId: 'session-1', providerId: 'strava' });
    expect(mockUpdateProviderUploadState).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'uploaded',
      externalId: 'ext-123',
      errorMessage: null,
    });
  });

  it('loads or creates the provider upload record through the repository helper', async () => {
    const provider = createMockProvider();
    mockGetExportProvider.mockReturnValue(provider);
    mockGetSessionById.mockReturnValue(FINISHED_SESSION);
    mockGetOrCreateProviderUpload.mockReturnValue(READY_UPLOAD);
    mockClaimProviderUpload.mockReturnValue({ ...READY_UPLOAD, uploadState: 'uploading' });
    mockGetSamplesBySessionId.mockReturnValue([]);

    await uploadSessionToProvider('session-1', 'strava');

    expect(mockGetOrCreateProviderUpload).toHaveBeenCalledWith({ sessionId: 'session-1', providerId: 'strava' });
  });

  it('fails gracefully when provider is not registered', async () => {
    mockGetExportProvider.mockReturnValue(undefined);

    const result = await uploadSessionToProvider('session-1', 'unknown');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('not registered');
  });

  it('fails gracefully when provider is not configured', async () => {
    const provider = createMockProvider({ isConfigured: () => false });
    mockGetExportProvider.mockReturnValue(provider);

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('not configured');
  });

  it('fails gracefully when session is not found', async () => {
    mockGetExportProvider.mockReturnValue(createMockProvider());
    mockGetSessionById.mockReturnValue(null);

    const result = await uploadSessionToProvider('missing', 'strava');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('not found');
  });

  it('fails gracefully when session is not finished', async () => {
    mockGetExportProvider.mockReturnValue(createMockProvider());
    mockGetSessionById.mockReturnValue({ ...FINISHED_SESSION, status: 'active' as const });

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('not finished');
  });

  it('prevents double upload when already uploading', async () => {
    mockGetExportProvider.mockReturnValue(createMockProvider());
    mockGetSessionById.mockReturnValue(FINISHED_SESSION);
    mockGetOrCreateProviderUpload.mockReturnValue({ ...READY_UPLOAD, uploadState: 'uploading' });

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('already in progress');
    expect(mockClaimProviderUpload).not.toHaveBeenCalled();
    expect(mockUpdateProviderUploadState).not.toHaveBeenCalled();
  });

  it('returns success for already uploaded session', async () => {
    mockGetExportProvider.mockReturnValue(createMockProvider());
    mockGetSessionById.mockReturnValue(FINISHED_SESSION);
    mockGetOrCreateProviderUpload.mockReturnValue({ ...READY_UPLOAD, uploadState: 'uploaded', externalId: 'ext-99' });

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result).toEqual({ providerId: 'strava', success: true, externalId: 'ext-99' });
    expect(mockClaimProviderUpload).not.toHaveBeenCalled();
    expect(mockUpdateProviderUploadState).not.toHaveBeenCalled();
  });

  it('returns already in progress when another caller wins the upload claim race', async () => {
    mockGetExportProvider.mockReturnValue(createMockProvider());
    mockGetSessionById.mockReturnValue(FINISHED_SESSION);
    mockGetOrCreateProviderUpload.mockReturnValue(READY_UPLOAD);
    mockClaimProviderUpload.mockReturnValue(null);
    mockGetProviderUpload.mockReturnValue({ ...READY_UPLOAD, uploadState: 'uploading' });

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result).toEqual({ providerId: 'strava', success: false, errorMessage: 'Upload already in progress.' });
    expect(mockGetProviderUpload).toHaveBeenCalledWith('session-1', 'strava');
    expect(mockUpdateProviderUploadState).not.toHaveBeenCalled();
  });

  it('transitions to failed when provider returns unsuccessful result', async () => {
    const provider = createMockProvider({
      exportSession: jest.fn().mockResolvedValue({ success: false, errorMessage: 'Rate limited' }),
    });
    mockGetExportProvider.mockReturnValue(provider);
    mockGetSessionById.mockReturnValue(FINISHED_SESSION);
    mockGetOrCreateProviderUpload.mockReturnValue(READY_UPLOAD);
    mockClaimProviderUpload.mockReturnValue({ ...READY_UPLOAD, uploadState: 'uploading' });
    mockGetSamplesBySessionId.mockReturnValue([]);

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result).toEqual({ providerId: 'strava', success: false, errorMessage: 'Rate limited' });
    expect(mockUpdateProviderUploadState).toHaveBeenLastCalledWith({
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'failed',
      externalId: null,
      errorMessage: 'Rate limited',
    });
  });

  it('transitions to failed when provider throws an error', async () => {
    const provider = createMockProvider({
      exportSession: jest.fn().mockRejectedValue(new Error('Network timeout')),
    });
    mockGetExportProvider.mockReturnValue(provider);
    mockGetSessionById.mockReturnValue(FINISHED_SESSION);
    mockGetOrCreateProviderUpload.mockReturnValue(READY_UPLOAD);
    mockClaimProviderUpload.mockReturnValue({ ...READY_UPLOAD, uploadState: 'uploading' });
    mockGetSamplesBySessionId.mockReturnValue([]);

    const result = await uploadSessionToProvider('session-1', 'strava');

    expect(result).toEqual({ providerId: 'strava', success: false, errorMessage: 'Network timeout' });
    expect(mockUpdateProviderUploadState).toHaveBeenLastCalledWith({
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'failed',
      externalId: null,
      errorMessage: 'Network timeout',
    });
  });
});
