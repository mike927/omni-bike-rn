import { fireEvent, render } from '@testing-library/react-native';

import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../../training/navigation/trainingSummaryRoute';
import { HistoryScreen } from '../HistoryScreen';

const mockPush = jest.fn();
const mockLatestWorkout = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../../training/hooks/useTrainingSession', () => ({
  useTrainingSession: () => ({
    phase: 'idle',
    elapsedSeconds: 0,
    totalDistance: 0,
    totalCalories: 0,
    currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null },
    start: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    finish: jest.fn(),
    finishAndDisconnect: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('../../../training/hooks/useLatestWorkout', () => ({
  useLatestWorkout: () => mockLatestWorkout(),
}));

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestWorkout.mockReturnValue(null);
  });

  it('renders without crashing', () => {
    expect(() => render(<HistoryScreen />)).not.toThrow();
  });

  it('shows the History heading', () => {
    const { getByText } = render(<HistoryScreen />);
    expect(getByText('History')).toBeTruthy();
  });

  it('opens the latest summary when one exists', () => {
    mockLatestWorkout.mockReturnValue({
      id: 'session-7',
      status: 'finished',
      startedAtMs: 10,
      endedAtMs: 20,
      elapsedSeconds: 60,
      totalDistanceMeters: 1000,
      totalCaloriesKcal: 10,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
      savedBikeSnapshot: null,
      savedHrSnapshot: null,
      uploadState: 'ready',
      createdAtMs: 10,
      updatedAtMs: 20,
    });

    const { getByText } = render(<HistoryScreen />);
    fireEvent.press(getByText('Open Latest Summary'));

    expect(mockPush).toHaveBeenCalledWith(
      buildTrainingSummaryRoute('session-7', SAVED_SESSION_TRAINING_SUMMARY_SOURCE, '/history'),
    );
  });
});
