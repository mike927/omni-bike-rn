import { fireEvent, render } from '@testing-library/react-native';

import { TrainingDashboardScreen } from '../TrainingDashboardScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();

const mockSession = {
  phase: 'idle',
  elapsedSeconds: 0,
  totalDistance: 0,
  totalCalories: 0,
  currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
  start: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  finish: jest.fn(),
  reset: jest.fn(),
};

const mockDeviceConnection = {
  bikeConnected: false,
  hrConnected: false,
  latestBikeMetrics: null,
  latestHr: null,
  connectBike: jest.fn(),
  connectHr: jest.fn(),
  disconnectAll: jest.fn(),
};

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

jest.mock('../../hooks/useTrainingSession', () => ({
  useTrainingSession: () => mockSession,
}));

jest.mock('../../hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => mockDeviceConnection,
}));

describe('TrainingDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockSession, {
      phase: 'idle',
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: false,
      hrConnected: false,
      latestBikeMetrics: null,
      latestHr: null,
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<TrainingDashboardScreen />)).not.toThrow();
  });

  it('shows the training heading and primary metric sections', () => {
    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Training')).toBeTruthy();
    expect(getByText('Live Ride')).toBeTruthy();
    expect(getByText('Session Controls')).toBeTruthy();
    expect(getByText('Ride Details')).toBeTruthy();
    expect(getByText('Elapsed')).toBeTruthy();
    expect(getByText('Speed')).toBeTruthy();
    expect(getByText('Heart Rate')).toBeTruthy();
    expect(getByText('Power')).toBeTruthy();
    expect(getByText('Calories')).toBeTruthy();
  });

  it('does not expose a reset action', () => {
    const { queryByText } = render(<TrainingDashboardScreen />);
    expect(queryByText('Reset')).toBeNull();
  });

  it('shows disconnected-bike recovery actions before a workout starts', () => {
    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Bike connection required')).toBeTruthy();
    expect(
      getByText('Connect your saved bike or choose one in setup before you start a workout from this screen.'),
    ).toBeTruthy();

    fireEvent.press(getByText('Start'));
    expect(mockSession.start).not.toHaveBeenCalled();

    fireEvent.press(getByText('Set Up Bike'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=bike');

    fireEvent.press(getByText('Back Home'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('hides disconnected-bike recovery UI and starts the workout when a bike is connected', () => {
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
    });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(queryByText('Bike connection required')).toBeNull();

    fireEvent.press(getByText('Start'));
    expect(mockSession.start).toHaveBeenCalledTimes(1);
  });

  it('shows active-session controls and live metrics', () => {
    Object.assign(mockSession, {
      phase: 'active',
      elapsedSeconds: 321,
      totalCalories: 45.6,
      totalDistance: 1234,
      currentMetrics: { speed: 31.2, cadence: 92, power: 248, heartRate: 151, resistance: 7, distance: 1234 },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      hrConnected: true,
      latestHr: 144,
    });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByText('00:05:21')).toBeTruthy();
    expect(getByText('31.2 km/h')).toBeTruthy();
    expect(getByText('151 bpm')).toBeTruthy();
    expect(getByText('248 W')).toBeTruthy();
    expect(getByText('45.6 kcal')).toBeTruthy();
    expect(getByText('Pause')).toBeTruthy();
    expect(getByText('Finish')).toBeTruthy();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('View Summary')).toBeNull();
  });

  it('shows paused-session controls only when paused', () => {
    Object.assign(mockSession, {
      phase: 'paused',
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
    });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Resume')).toBeTruthy();
    expect(getByText('Finish')).toBeTruthy();
    expect(queryByText('Pause')).toBeNull();
  });

  it('shows the summary action after a workout is finished', () => {
    Object.assign(mockSession, {
      phase: 'finished',
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
    });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByText('View Summary')).toBeTruthy();
    expect(queryByText('Pause')).toBeNull();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('Finish')).toBeNull();

    fireEvent.press(getByText('View Summary'));
    expect(mockPush).toHaveBeenCalledWith('/summary');
  });

  it('falls back to the latest HR source when the merged session value is unavailable', () => {
    Object.assign(mockSession, {
      phase: 'active',
      currentMetrics: { speed: 29.4, cadence: 86, power: 211, heartRate: null, resistance: 5, distance: 950 },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      hrConnected: true,
      latestHr: 142,
    });

    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('142 bpm')).toBeTruthy();
  });
});
