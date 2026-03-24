import { render } from '@testing-library/react-native';

import { HistoryScreen } from '../HistoryScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
    reset: jest.fn(),
  }),
}));

describe('HistoryScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<HistoryScreen />)).not.toThrow();
  });

  it('shows the History heading', () => {
    const { getByText } = render(<HistoryScreen />);
    expect(getByText('History')).toBeTruthy();
  });
});
