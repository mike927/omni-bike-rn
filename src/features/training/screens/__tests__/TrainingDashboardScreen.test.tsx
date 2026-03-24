import { render } from '@testing-library/react-native';

import { TrainingDashboardScreen } from '../TrainingDashboardScreen';

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

jest.mock('../../hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => ({
    bikeConnected: false,
    hrConnected: false,
    latestBikeMetrics: null,
    latestHr: null,
    connectBike: jest.fn(),
    connectHr: jest.fn(),
    disconnectAll: jest.fn(),
  }),
}));

describe('TrainingDashboardScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<TrainingDashboardScreen />)).not.toThrow();
  });

  it('shows the Training heading', () => {
    const { getByText } = render(<TrainingDashboardScreen />);
    expect(getByText('Training')).toBeTruthy();
  });
});
