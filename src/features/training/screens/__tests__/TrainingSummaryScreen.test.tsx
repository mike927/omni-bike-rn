import { render } from '@testing-library/react-native';

import { TrainingSummaryScreen } from '../TrainingSummaryScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../hooks/useTrainingSession', () => ({
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
    reset: jest.fn(),
  }),
}));

describe('TrainingSummaryScreen', () => {
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
});
