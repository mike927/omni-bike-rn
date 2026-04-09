import { act, renderHook } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useWorkoutHistory } from '../useWorkoutHistory';
import { deleteSession, getFinishedSessions } from '../../../../services/db/trainingSessionRepository';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../../../../services/db/trainingSessionRepository', () => ({
  deleteSession: jest.fn(),
  getFinishedSessions: jest.fn(),
}));

describe('useWorkoutHistory', () => {
  const mockUseFocusEffect = useFocusEffect as jest.MockedFunction<typeof useFocusEffect>;
  const mockDeleteSession = deleteSession as jest.MockedFunction<typeof deleteSession>;
  const mockGetFinishedSessions = getFinishedSessions as jest.MockedFunction<typeof getFinishedSessions>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes sessions whenever the screen gains focus', () => {
    let focusCallback: (() => void) | undefined;

    mockUseFocusEffect.mockImplementation((callback) => {
      focusCallback = callback as unknown as () => void;
    });

    mockGetFinishedSessions.mockReturnValueOnce([]).mockReturnValueOnce([
      {
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
      },
    ]);

    const { result } = renderHook(() => useWorkoutHistory());

    act(() => {
      focusCallback?.();
    });

    expect(result.current.sessions).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    act(() => {
      focusCallback?.();
    });

    expect(result.current.sessions.map((session) => session.id)).toEqual(['session-2']);
    expect(result.current.isLoading).toBe(false);
  });

  it('deletes a workout and refreshes the session list', () => {
    let focusCallback: (() => void) | undefined;

    mockUseFocusEffect.mockImplementation((callback) => {
      focusCallback = callback as unknown as () => void;
    });

    mockGetFinishedSessions
      .mockReturnValueOnce([
        {
          id: 'session-1',
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
        },
      ])
      .mockReturnValueOnce([]);

    const { result } = renderHook(() => useWorkoutHistory());

    act(() => {
      focusCallback?.();
    });

    expect(result.current.sessions.map((session) => session.id)).toEqual(['session-1']);

    act(() => {
      result.current.deleteWorkout('session-1');
    });

    expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
    expect(result.current.sessions).toEqual([]);
  });
});
