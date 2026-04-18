import { saveWorkout } from '../../health/appleHealthAdapter';
import { useAppleHealthConnectionStore } from '../../../store/appleHealthConnectionStore';
import { AppleHealthExportProvider } from '../AppleHealthExportProvider';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../types/sessionPersistence';

jest.mock('../../health/appleHealthAdapter', () => ({
  saveWorkout: jest.fn(),
}));

jest.mock('../../../store/appleHealthConnectionStore', () => ({
  useAppleHealthConnectionStore: { getState: jest.fn() },
}));

const mockSaveWorkout = saveWorkout as jest.Mock;
const mockGetState = useAppleHealthConnectionStore.getState as jest.Mock;

const SESSION: PersistedTrainingSession = {
  id: 'session-1',
  status: 'finished',
  startedAtMs: 1_700_000_000_000,
  endedAtMs: 1_700_003_600_000,
  elapsedSeconds: 3600,
  totalDistanceMeters: 18000,
  totalCaloriesKcal: 450,
  currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
  savedBikeSnapshot: null,
  savedHrSnapshot: null,
  uploadState: null,
  createdAtMs: 1_700_000_000_000,
  updatedAtMs: 1_700_003_600_000,
};

const SAMPLES: PersistedTrainingSample[] = [];

let provider: AppleHealthExportProvider;

beforeEach(() => {
  jest.clearAllMocks();
  provider = new AppleHealthExportProvider();
});

describe('isConfigured', () => {
  it('returns false when disconnected', () => {
    mockGetState.mockReturnValue({ connected: false });
    expect(provider.isConfigured()).toBe(false);
  });

  it('returns true when connected', () => {
    mockGetState.mockReturnValue({ connected: true });
    expect(provider.isConfigured()).toBe(true);
  });
});

describe('exportSession', () => {
  it('returns failure when disconnected before any native call', async () => {
    mockGetState.mockReturnValue({ connected: false });
    const result = await provider.exportSession(SESSION, SAMPLES);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('Not connected');
    expect(mockSaveWorkout).not.toHaveBeenCalled();
  });

  it('returns success with workout uuid on happy path', async () => {
    mockGetState.mockReturnValue({ connected: true });
    mockSaveWorkout.mockResolvedValue({
      workoutId: 'workout-uuid-xyz',
      attemptedHrSampleCount: 0,
      failedHrSampleCount: 0,
    });

    const result = await provider.exportSession(SESSION, SAMPLES);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe('workout-uuid-xyz');
    expect(result.warningMessage).toBeUndefined();
    expect(mockSaveWorkout).toHaveBeenCalledWith(SESSION, SAMPLES);
  });

  it('returns success with a warning when some HR samples could not be saved', async () => {
    mockGetState.mockReturnValue({ connected: true });
    mockSaveWorkout.mockResolvedValue({
      workoutId: 'workout-uuid-partial',
      attemptedHrSampleCount: 10,
      failedHrSampleCount: 3,
    });

    const result = await provider.exportSession(SESSION, SAMPLES);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe('workout-uuid-partial');
    expect(result.warningMessage).toContain('3 of 10');
  });

  it('returns failure when saveWorkout throws', async () => {
    mockGetState.mockReturnValue({ connected: true });
    mockSaveWorkout.mockRejectedValue(new Error('HealthKit error'));

    const result = await provider.exportSession(SESSION, SAMPLES);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('HealthKit error');
  });
});
