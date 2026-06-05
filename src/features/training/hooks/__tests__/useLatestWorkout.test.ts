import { act, renderHook } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useLatestWorkout } from '../useLatestWorkout';
import { getLatestFinishedSession } from '../../../../services/db/trainingSessionRepository';

jest.mock('@react-navigation/native', () => ({
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

  it('refreshes the latest workout whenever the screen gains focus', () => {
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

    const { result } = renderHook(() => useLatestWorkout());

    act(() => {
      focusCallback?.();
    });
    expect(result.current).toBeNull();

    act(() => {
      focusCallback?.();
    });
    expect(result.current?.id).toBe('session-2');
  });

  it('returns null and does not throw when the read fails', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let focusCallback: (() => void) | undefined;

    mockUseFocusEffect.mockImplementation((callback) => {
      focusCallback = callback as unknown as () => void;
    });
    mockGetLatestFinishedSession.mockImplementation(() => {
      throw new Error('db read failed');
    });

    const { result } = renderHook(() => useLatestWorkout());

    expect(() =>
      act(() => {
        focusCallback?.();
      }),
    ).not.toThrow();
    expect(result.current).toBeNull();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
