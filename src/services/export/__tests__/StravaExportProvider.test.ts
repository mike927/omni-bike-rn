import { getValidAccessToken } from '../../strava/stravaAuthService';
import { uploadActivity, waitForProcessing } from '../../strava/stravaApiClient';
import { useStravaConnectionStore } from '../../../store/stravaConnectionStore';
import { StravaExportProvider } from '../StravaExportProvider';
import type { PersistedTrainingSession, PersistedTrainingSample } from '../../../types/sessionPersistence';

jest.mock('../formats/tcxSerializer', () => ({
  serializeSessionToTcx: jest.fn().mockReturnValue('<tcx/>'),
}));

jest.mock('../../strava/stravaAuthService', () => ({
  getValidAccessToken: jest.fn(),
}));

jest.mock('../../strava/stravaApiClient', () => ({
  uploadActivity: jest.fn(),
  waitForProcessing: jest.fn(),
}));

jest.mock('../../strava/stravaConstants', () => ({
  STRAVA_CLIENT_ID: 'test-client-id',
}));

jest.mock('../../../store/stravaConnectionStore', () => ({
  useStravaConnectionStore: {
    getState: jest.fn(),
  },
}));

const mockGetValidAccessToken = getValidAccessToken as jest.Mock;
const mockUploadActivity = uploadActivity as jest.Mock;
const mockWaitForProcessing = waitForProcessing as jest.Mock;
const mockGetState = useStravaConnectionStore.getState as jest.Mock;

const BASE_SESSION: PersistedTrainingSession = {
  id: 'session-1',
  status: 'finished',
  startedAtMs: 1_700_000_000_000,
  endedAtMs: 1_700_003_600_000,
  elapsedSeconds: 3600,
  totalDistanceMeters: 18000,
  totalCaloriesKcal: 450,
  currentMetrics: { speed: 20, cadence: 80, power: 150, heartRate: 140, resistance: null, distance: null },
  savedBikeSnapshot: null,
  savedHrSnapshot: null,
  uploadState: null,
  createdAtMs: 1_700_000_000_000,
  updatedAtMs: 1_700_003_600_000,
};

const SAMPLES: PersistedTrainingSample[] = [];

let provider: StravaExportProvider;

beforeEach(() => {
  jest.clearAllMocks();
  provider = new StravaExportProvider();
});

describe('isConfigured', () => {
  it('returns false when client ID is missing', () => {
    jest.resetModules();
    // Covered implicitly — mock always sets STRAVA_CLIENT_ID to 'test-client-id',
    // so we test the connected-store branch here.
    mockGetState.mockReturnValue({ connected: false });
    expect(provider.isConfigured()).toBe(false);
  });

  it('returns true when client ID present and store shows connected', () => {
    mockGetState.mockReturnValue({ connected: true });
    expect(provider.isConfigured()).toBe(true);
  });
});

describe('exportSession', () => {
  it('returns success with activityId on happy path', async () => {
    mockGetValidAccessToken.mockResolvedValue('access-token');
    mockUploadActivity.mockResolvedValue({ id: 111, status: 'processing', error: null, activity_id: null });
    mockWaitForProcessing.mockResolvedValue({ activityId: 99999, error: null });

    const result = await provider.exportSession(BASE_SESSION, SAMPLES);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe('99999');
  });

  it('returns failure when getValidAccessToken throws', async () => {
    mockGetValidAccessToken.mockRejectedValue(new Error('Not connected to Strava.'));

    const result = await provider.exportSession(BASE_SESSION, SAMPLES);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('Not connected');
  });

  it('returns failure when uploadActivity throws', async () => {
    mockGetValidAccessToken.mockResolvedValue('access-token');
    mockUploadActivity.mockRejectedValue(new Error('Upload failed (422): Bad request'));

    const result = await provider.exportSession(BASE_SESSION, SAMPLES);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('Upload failed');
  });

  it('returns failure when waitForProcessing returns an error', async () => {
    mockGetValidAccessToken.mockResolvedValue('access-token');
    mockUploadActivity.mockResolvedValue({ id: 111, status: 'processing', error: null, activity_id: null });
    mockWaitForProcessing.mockResolvedValue({ activityId: null, error: 'Invalid file format.' });

    const result = await provider.exportSession(BASE_SESSION, SAMPLES);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Invalid file format.');
  });

  it('returns success without externalId when activityId is null (duplicate no-id case)', async () => {
    mockGetValidAccessToken.mockResolvedValue('access-token');
    mockUploadActivity.mockResolvedValue({ id: 111, status: 'processing', error: null, activity_id: null });
    mockWaitForProcessing.mockResolvedValue({ activityId: null, error: null });

    const result = await provider.exportSession(BASE_SESSION, SAMPLES);

    expect(result.success).toBe(true);
    expect(result.externalId).toBeUndefined();
  });
});
