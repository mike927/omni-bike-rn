import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { buildTrainingSummaryRoute, POST_FINISH_TRAINING_SUMMARY_SOURCE } from '../../navigation/trainingSummaryRoute';
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
  finishAndDisconnect: jest.fn().mockResolvedValue('session-1'),
  reset: jest.fn(),
};

const mockDeviceConnection = {
  bikeConnected: false,
  hrConnected: false,
  latestBikeMetrics: null,
  latestBluetoothHr: null,
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
      finishAndDisconnect: jest.fn().mockResolvedValue('session-1'),
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: false,
      hrConnected: false,
      latestBikeMetrics: null,
      latestBluetoothHr: null,
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<TrainingDashboardScreen />)).not.toThrow();
  });

  it('shows disconnected-bike recovery actions before a workout starts', () => {
    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Bike connection required')).toBeTruthy();

    fireEvent.press(getByText('Start Ride'));
    expect(mockSession.start).not.toHaveBeenCalled();

    fireEvent.press(getByText('Set Up Bike'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=bike');

    fireEvent.press(getByText('Back Home'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('starts the workout once the bike is connected', () => {
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText } = render(<TrainingDashboardScreen />);
    fireEvent.press(getByText('Start Ride'));

    expect(mockSession.start).toHaveBeenCalledTimes(1);
  });

  it('shows Pause and Finish while active', () => {
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
      latestBluetoothHr: 144,
    });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Pause')).toBeTruthy();
    expect(getByText('Finish')).toBeTruthy();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('View Summary')).toBeNull();
  });

  it('shows Resume and Finish while paused', () => {
    Object.assign(mockSession, { phase: 'paused' });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Resume')).toBeTruthy();
    expect(getByText('Finish')).toBeTruthy();
    expect(queryByText('Pause')).toBeNull();
  });

  it('shows reconnection guidance when a paused session has no bike connection', () => {
    Object.assign(mockSession, { phase: 'paused' });
    Object.assign(mockDeviceConnection, { bikeConnected: false });

    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Bike connection required')).toBeTruthy();
    expect(
      getByText('Reconnect your saved bike or choose one in setup before you resume this interrupted workout.'),
    ).toBeTruthy();
  });

  it('does not show a summary action once the session is already finished', () => {
    Object.assign(mockSession, { phase: 'finished' });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { queryByText } = render(<TrainingDashboardScreen />);

    expect(queryByText('Pause')).toBeNull();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('Finish')).toBeNull();
    expect(queryByText('View Summary')).toBeNull();
  });

  it('finishes, disconnects, and routes directly to summary', async () => {
    let resolveFinish: ((value: string | null) => void) | undefined;
    Object.assign(mockSession, {
      phase: 'active',
      finishAndDisconnect: jest.fn().mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            resolveFinish = resolve;
          }),
      ),
    });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    fireEvent.press(getByText('Finish'));

    expect(getByText('Finishing...')).toBeTruthy();
    expect(queryByText('Finish')).toBeNull();

    resolveFinish?.('session-77');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        buildTrainingSummaryRoute('session-77', POST_FINISH_TRAINING_SUMMARY_SOURCE, '/'),
      );
    });
  });

  it('falls back to the latest HR source when the merged session value is unavailable', () => {
    Object.assign(mockSession, {
      phase: 'active',
      currentMetrics: { speed: 29.4, cadence: 86, power: 211, heartRate: null, resistance: 5, distance: 950 },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      hrConnected: true,
      latestBluetoothHr: 142,
    });

    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('142 bpm')).toBeTruthy();
  });
});
