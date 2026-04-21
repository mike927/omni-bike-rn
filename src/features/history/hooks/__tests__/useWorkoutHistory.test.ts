import { act, renderHook } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getProviderUploadsBySessionId } from '../../../../services/db/providerUploadRepository';
import { deleteSession, getFinishedSessions } from '../../../../services/db/trainingSessionRepository';
import { APPLE_HEALTH_PROVIDER_ID, STRAVA_PROVIDER_ID } from '../../../../services/export/providerIds';
import type { PersistedProviderUpload, PersistedTrainingSession } from '../../../../types/sessionPersistence';
import { useWorkoutHistory } from '../useWorkoutHistory';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../../../../services/db/trainingSessionRepository', () => ({
  deleteSession: jest.fn(),
  getFinishedSessions: jest.fn(),
}));

jest.mock('../../../../services/db/providerUploadRepository', () => ({
  getProviderUploadsBySessionId: jest.fn(),
}));

const mockUseFocusEffect = useFocusEffect as jest.MockedFunction<typeof useFocusEffect>;
const mockDeleteSession = deleteSession as jest.MockedFunction<typeof deleteSession>;
const mockGetFinishedSessions = getFinishedSessions as jest.MockedFunction<typeof getFinishedSessions>;
const mockGetProviderUploadsBySessionId = getProviderUploadsBySessionId as jest.MockedFunction<
  typeof getProviderUploadsBySessionId
>;

function buildSession(id: string): PersistedTrainingSession {
  return {
    id,
    status: 'finished',
    startedAtMs: 100,
    endedAtMs: 200,
    elapsedSeconds: 300,
    totalDistanceMeters: 4000,
    totalCaloriesKcal: 50,
    currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    savedBikeSnapshot: null,
    savedHrSnapshot: null,
    uploadState: 'ready',
    createdAtMs: 100,
    updatedAtMs: 200,
  };
}

function buildUpload(
  overrides: Partial<PersistedProviderUpload> & Pick<PersistedProviderUpload, 'providerId'>,
): PersistedProviderUpload {
  return {
    id: `upload-${overrides.providerId}`,
    sessionId: 'session-1',
    uploadState: 'uploaded',
    externalId: null,
    errorMessage: null,
    createdAtMs: 100,
    updatedAtMs: 100,
    ...overrides,
  };
}

function primeFocusCallback(): { trigger: () => void } {
  let focusCallback: (() => void) | undefined;
  mockUseFocusEffect.mockImplementation((callback) => {
    focusCallback = callback as unknown as () => void;
  });
  return {
    trigger: () => {
      focusCallback?.();
    },
  };
}

describe('useWorkoutHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProviderUploadsBySessionId.mockReturnValue([]);
  });

  it('refreshes items whenever the screen gains focus', () => {
    const { trigger } = primeFocusCallback();
    mockGetFinishedSessions.mockReturnValueOnce([]).mockReturnValueOnce([buildSession('session-2')]);

    const { result } = renderHook(() => useWorkoutHistory());

    act(() => {
      trigger();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    act(() => {
      trigger();
    });

    expect(result.current.items.map((item) => item.session.id)).toEqual(['session-2']);
    expect(result.current.isLoading).toBe(false);
  });

  it('deletes a workout and refreshes the item list', () => {
    const { trigger } = primeFocusCallback();
    mockGetFinishedSessions.mockReturnValueOnce([buildSession('session-1')]).mockReturnValueOnce([]);

    const { result } = renderHook(() => useWorkoutHistory());

    act(() => {
      trigger();
    });

    expect(result.current.items.map((item) => item.session.id)).toEqual(['session-1']);

    act(() => {
      result.current.deleteWorkout('session-1');
    });

    expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
    expect(result.current.items).toEqual([]);
  });

  it('includes only providers whose uploadState is uploaded', () => {
    const { trigger } = primeFocusCallback();
    mockGetFinishedSessions.mockReturnValueOnce([buildSession('session-1')]);
    mockGetProviderUploadsBySessionId.mockReturnValueOnce([
      buildUpload({ providerId: STRAVA_PROVIDER_ID, uploadState: 'uploaded' }),
      buildUpload({ providerId: APPLE_HEALTH_PROVIDER_ID, uploadState: 'failed' }),
    ]);

    const { result } = renderHook(() => useWorkoutHistory());

    act(() => {
      trigger();
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.uploadedProviderIds).toEqual([STRAVA_PROVIDER_ID]);
  });

  it('returns uploadedProviderIds in canonical order regardless of DB row order', () => {
    const { trigger } = primeFocusCallback();
    mockGetFinishedSessions.mockReturnValueOnce([buildSession('session-1')]);
    mockGetProviderUploadsBySessionId.mockReturnValueOnce([
      buildUpload({ providerId: APPLE_HEALTH_PROVIDER_ID, uploadState: 'uploaded', createdAtMs: 100 }),
      buildUpload({ providerId: STRAVA_PROVIDER_ID, uploadState: 'uploaded', createdAtMs: 200 }),
    ]);

    const { result } = renderHook(() => useWorkoutHistory());

    act(() => {
      trigger();
    });

    expect(result.current.items[0]?.uploadedProviderIds).toEqual([STRAVA_PROVIDER_ID, APPLE_HEALTH_PROVIDER_ID]);
  });

  it('filters out unknown provider IDs that are not in KNOWN_PROVIDER_DISPLAY_ORDER', () => {
    const { trigger } = primeFocusCallback();
    mockGetFinishedSessions.mockReturnValueOnce([buildSession('session-1')]);
    mockGetProviderUploadsBySessionId.mockReturnValueOnce([
      buildUpload({ providerId: 'garmin_connect', uploadState: 'uploaded' }),
    ]);

    const { result } = renderHook(() => useWorkoutHistory());

    act(() => {
      trigger();
    });

    expect(result.current.items[0]?.uploadedProviderIds).toEqual([]);
  });
});
