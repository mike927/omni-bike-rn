import { render } from '@testing-library/react-native';

import { TrainingSummaryScreen } from '../TrainingSummaryScreen';

const mockReplace = jest.fn();
const mockSession = {
  phase: 'idle',
  elapsedSeconds: 0,
  totalDistance: 0,
  totalCalories: 0,
  currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null },
  start: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  finish: jest.fn(),
  reset: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../hooks/useTrainingSession', () => ({
  useTrainingSession: () => mockSession,
}));

describe('TrainingSummaryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockSession, {
      phase: 'idle',
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null },
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<TrainingSummaryScreen />)).not.toThrow();
  });

  it('shows the Summary heading', () => {
    const { getByText } = render(<TrainingSummaryScreen />);
    expect(getByText('Summary')).toBeTruthy();
  });

  it('shows empty state when no workout has been recorded', () => {
    const { getByText } = render(<TrainingSummaryScreen />);
    expect(getByText('No Workout Yet')).toBeTruthy();
  });

  it('shows a done action instead of reset when the workout is finished', () => {
    Object.assign(mockSession, {
      phase: 'finished',
      elapsedSeconds: 120,
      totalDistance: 1000,
      totalCalories: 50,
    });

    const { getByText, queryByText } = render(<TrainingSummaryScreen />);

    expect(getByText('Done')).toBeTruthy();
    expect(queryByText('Reset Session')).toBeNull();
  });
});
