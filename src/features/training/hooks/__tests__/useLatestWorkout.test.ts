import { act, renderHook } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';

import { useLatestWorkout } from '../useLatestWorkout';
import { getLatestFinishedSession } from '../../../../services/db/trainingSessionRepository';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../../../../services/db/trainingSessionRepository', () => ({
  getLatestFinishedSession: jest.fn(),
}));

describe('useLatestWorkout', () => {
  const mockUseFocusEffect = useFocusEffect as jest.MockedFunction<typeof useFocusEffect>;
  const mockGetLatestFinishedSession = getLatestFinishedSession as jest.MockedFunction<typeof getLatestFinishedSession>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes the latest workout whenever the screen gains focus', async () => {
    let focusCallback: (() => void) | undefined;

    mockUseFocusEffect.mockImplementation((callback) => {
      focusCallback = callback as unknown as () => void;
    });

    mockGetLatestFinishedSession.mockReturnValueOnce(null).mockReturnValueOnce({
      id: 'session-2',
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
    });

    const { result } = await renderHook(() => useLatestWorkout());

    await act(() => {
      focusCallback?.();
    });
    expect(result.current).toBeNull();

    await act(() => {
      focusCallback?.();
    });
    expect(result.current?.id).toBe('session-2');
  });

  it('returns null and does not throw when the read fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let focusCallback: (() => void) | undefined;

    mockUseFocusEffect.mockImplementation((callback) => {
      focusCallback = callback as unknown as () => void;
    });
    mockGetLatestFinishedSession.mockImplementation(() => {
      throw new Error('db read failed');
    });

    const { result } = await renderHook(() => useLatestWorkout());

    await expect(
      act(() => {
        focusCallback?.();
      }),
    ).resolves.toBeUndefined();
    expect(result.current).toBeNull();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
