import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../../training/navigation/trainingSummaryRoute';
import { STRAVA_PROVIDER_ID } from '../../../../services/export/providerIds';
import { HistoryScreen } from '../HistoryScreen';
import { formatSessionDate } from '../../../../ui/formatters';
import type { PersistedTrainingSession } from '../../../../types/sessionPersistence';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDeleteWorkout = jest.fn();
const mockUseWorkoutHistory = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../hooks/useWorkoutHistory', () => ({
  useWorkoutHistory: () => mockUseWorkoutHistory(),
}));

function buildSession(id: string): PersistedTrainingSession {
  return {
    id,
    status: 'finished',
    startedAtMs: 1744200000000,
    endedAtMs: 1744203600000,
    elapsedSeconds: 60,
    totalDistanceMeters: 1000,
    totalCaloriesKcal: 10,
    currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    savedBikeSnapshot: null,
    savedHrSnapshot: null,
    uploadState: 'ready',
    createdAtMs: 10,
    updatedAtMs: 20,
  };
}

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorkoutHistory.mockReturnValue({
      items: [],
      isLoading: false,
      refresh: jest.fn(),
      deleteWorkout: mockDeleteWorkout,
    });
  });

  it('shows the empty state and routes home from Start Training', () => {
    const { getByText } = render(<HistoryScreen />);

    expect(getByText('No Workouts Yet')).toBeTruthy();
    expect(getByText('Your completed cycling sessions will appear here.')).toBeTruthy();

    fireEvent.press(getByText('Start Training'));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('opens a saved workout summary from the list', () => {
    const session = buildSession('session-7');

    mockUseWorkoutHistory.mockReturnValue({
      items: [{ session, uploadedProviderIds: [] }],
      isLoading: false,
      refresh: jest.fn(),
      deleteWorkout: mockDeleteWorkout,
    });

    const { getByLabelText } = render(<HistoryScreen />);
    fireEvent.press(getByLabelText(`Workout on ${formatSessionDate(session.startedAtMs)}`));

    expect(mockPush).toHaveBeenCalledWith(
      buildTrainingSummaryRoute('session-7', SAVED_SESSION_TRAINING_SUMMARY_SOURCE, '/history'),
    );
  });

  it('prompts before deleting a workout from the list', () => {
    const session = buildSession('session-7');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    mockUseWorkoutHistory.mockReturnValue({
      items: [{ session, uploadedProviderIds: [] }],
      isLoading: false,
      refresh: jest.fn(),
      deleteWorkout: mockDeleteWorkout,
    });

    const { getByLabelText } = render(<HistoryScreen />);
    fireEvent.press(getByLabelText('Delete workout'));

    expect(mockDeleteWorkout).toHaveBeenCalledWith('session-7');
    expect(mockPush).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Workout?',
      'Are you sure you want to delete this session? This cannot be undone.',
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });

  it('shows the provider status icon for an uploaded session', () => {
    const session = buildSession('session-7');

    mockUseWorkoutHistory.mockReturnValue({
      items: [{ session, uploadedProviderIds: [STRAVA_PROVIDER_ID] }],
      isLoading: false,
      refresh: jest.fn(),
      deleteWorkout: mockDeleteWorkout,
    });

    const { getByLabelText } = render(<HistoryScreen />);

    expect(getByLabelText('Exported to Strava')).toBeTruthy();
    expect(getByLabelText('Delete workout')).toBeTruthy();
  });
});
