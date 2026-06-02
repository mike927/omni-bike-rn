import { fireEvent, render } from '@testing-library/react-native';

import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../../training/navigation/trainingSummaryRoute';
import { TrainingPhase } from '../../../../types/training';
import { HomeScreen } from '../HomeScreen';

const mockPush = jest.fn();

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

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});

jest.mock('../../../gear/hooks/useAutoReconnect');
jest.mock('../../../gear/hooks/useSavedGear');
jest.mock('../../../training/hooks/useTrainingSession');
jest.mock('../../../training/hooks/useDeviceConnection');

const mockSession = {
  phase: TrainingPhase.Idle,
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
};

const mockConnection = {
  bikeConnected: false,
  hrConnected: false,
  latestBikeMetrics: null,
  latestBluetoothHr: null,
  latestAppleWatchHr: null,
  watchAvailability: 'unavailable',
};

const mockWatchHrControls = {
  watchAvailable: true,
  primary: null as null | 'watch' | 'bluetooth' | 'bike',
  effectivePrimary: 'bike' as 'watch' | 'bluetooth' | 'bike',
  setPrimary: jest.fn(),
  availableSources: ['bike'] as ('watch' | 'bluetooth' | 'bike')[],
};

const mockSavedGear = {
  savedBike: null as null | { id: string; name: string; type: 'bike' },
  savedHrSource: null as null | { id: string; name: string; type: 'hr' },
  forgetBike: jest.fn(),
  forgetHr: jest.fn(),
};

const mockAutoReconnect = {
  bikeReconnectState: 'idle' as const,
  hrReconnectState: 'idle' as const,
  retryBike: jest.fn(),
  retryHr: jest.fn(),
};

const mockLatestWorkoutHook = jest.fn();
const mockInterruptedSessionHook = jest.fn();

jest.mock('../../../training/hooks/useTrainingSession', () => ({
  useTrainingSession: () => mockSession,
}));

jest.mock('../../../training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => mockConnection,
}));

jest.mock('../../../gear/hooks/useSavedGear', () => ({
  useSavedGear: () => mockSavedGear,
}));

jest.mock('../../../gear/hooks/useAutoReconnect', () => ({
  useAutoReconnect: () => mockAutoReconnect,
}));

jest.mock('../../../training/hooks/useLatestWorkout', () => ({
  useLatestWorkout: () => mockLatestWorkoutHook(),
}));

jest.mock('../../../training/hooks/useInterruptedSession', () => ({
  useInterruptedSession: () => mockInterruptedSessionHook(),
}));

jest.mock('../../../gear/hooks/useWatchHrControls', () => ({
  useWatchHrControls: () => mockWatchHrControls,
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockSession, {
      phase: TrainingPhase.Idle,
    });
    Object.assign(mockConnection, {
      bikeConnected: false,
      hrConnected: false,
      latestBluetoothHr: null,
      latestAppleWatchHr: null,
      watchAvailability: 'unavailable',
    });
    Object.assign(mockWatchHrControls, {
      watchAvailable: true,
      primary: null,
      effectivePrimary: 'bike',
    });
    Object.assign(mockSavedGear, {
      savedBike: null,
      savedHrSource: null,
    });
    Object.assign(mockAutoReconnect, {
      bikeReconnectState: 'idle',
      hrReconnectState: 'idle',
    });
    mockLatestWorkoutHook.mockReturnValue(null);
    mockInterruptedSessionHook.mockReturnValue({
      interruptedSession: null,
      resumeInterruptedSession: jest.fn(),
      discardInterruptedSession: jest.fn(),
    });
  });

  it('shows the setup hero when no bike is saved', () => {
    // savedBike null (default mock), idle phase
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Set up your Smart Bike')).toBeTruthy();
  });

  it('shows Start Ride and navigates to training when bike connected and idle', () => {
    Object.assign(mockSavedGear, {
      savedBike: { id: 'bike-1', name: 'KICKR Bike', type: 'bike' },
    });
    Object.assign(mockConnection, { bikeConnected: true });

    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByText('Start Ride')).toBeTruthy();
    fireEvent.press(getByTestId('ride-hero'));
    expect(mockPush).toHaveBeenCalledWith('/training');
  });

  it('shows Resume Ride when a session is active', () => {
    Object.assign(mockSavedGear, {
      savedBike: { id: 'bike-1', name: 'KICKR Bike', type: 'bike' },
    });
    Object.assign(mockConnection, { bikeConnected: true });
    Object.assign(mockSession, { phase: TrainingPhase.Active });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Resume Ride')).toBeTruthy();
  });

  it('shows Resume Ride when a session is paused', () => {
    Object.assign(mockSavedGear, {
      savedBike: { id: 'bike-1', name: 'KICKR Bike', type: 'bike' },
    });
    Object.assign(mockConnection, { bikeConnected: true });
    Object.assign(mockSession, { phase: TrainingPhase.Paused });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Resume Ride')).toBeTruthy();
  });

  it('renders the Apple Watch device card only when the watch is available', () => {
    Object.assign(mockWatchHrControls, { watchAvailable: true });
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('device-watch')).toBeTruthy();
  });

  it('omits the Apple Watch device card when the watch is not available', () => {
    Object.assign(mockWatchHrControls, { watchAvailable: false });
    const { queryByTestId } = render(<HomeScreen />);
    expect(queryByTestId('device-watch')).toBeNull();
  });

  it('renders bike and HR device cards', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('device-bike')).toBeTruthy();
    expect(getByTestId('device-hr')).toBeTruthy();
  });

  it('shows saved bike name in the bike device card', () => {
    Object.assign(mockSavedGear, {
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
    });
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Zipro Rave')).toBeTruthy();
  });

  it('shows saved HR source name in the HR device card', () => {
    Object.assign(mockSavedGear, {
      savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' },
    });
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Polar H10')).toBeTruthy();
  });

  it('navigates to settings when Manage is pressed', () => {
    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Manage'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('navigates to the saved-session summary from the latest ride card', () => {
    mockLatestWorkoutHook.mockReturnValue({
      id: 's1',
      status: 'finished',
      startedAtMs: 100,
      endedAtMs: 200,
      elapsedSeconds: 900,
      totalDistanceMeters: 12345,
      totalCaloriesKcal: 321.5,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
      savedBikeSnapshot: null,
      savedHrSnapshot: null,
      uploadState: 'ready',
      createdAtMs: 100,
      updatedAtMs: 200,
    });

    const { getByLabelText } = render(<HomeScreen />);
    fireEvent.press(getByLabelText('View summary'));
    expect(mockPush).toHaveBeenCalledWith(buildTrainingSummaryRoute('s1', SAVED_SESSION_TRAINING_SUMMARY_SOURCE, '/'));
  });

  it('shows empty latest ride state when no workout exists', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('No rides yet')).toBeTruthy();
  });

  it('renders and resumes an interrupted session from Home', () => {
    const resumeInterruptedSession = jest.fn(() => true);
    mockInterruptedSessionHook.mockReturnValue({
      interruptedSession: {
        id: 'session-interrupted',
        status: 'paused',
        startedAtMs: 100,
        endedAtMs: null,
        elapsedSeconds: 600,
        totalDistanceMeters: 5400,
        totalCaloriesKcal: 88.4,
        currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
        savedBikeSnapshot: null,
        savedHrSnapshot: null,
        uploadState: null,
        createdAtMs: 100,
        updatedAtMs: 700,
      },
      resumeInterruptedSession,
      discardInterruptedSession: jest.fn(),
    });

    const { getByText } = render(<HomeScreen />);

    expect(getByText('Resume interrupted ride')).toBeTruthy();

    fireEvent.press(getByText('Resume'));
    expect(resumeInterruptedSession).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/training');
  });

  it('does not show the interrupted session card when no session is interrupted', () => {
    const { queryByText } = render(<HomeScreen />);
    expect(queryByText('Resume interrupted ride')).toBeNull();
  });

  describe('Bike pulse device card', () => {
    it('surfaces a Bike pulse card when bike is the effective HR source', () => {
      Object.assign(mockWatchHrControls, { watchAvailable: false, primary: 'bike', effectivePrimary: 'bike' });
      const { getByTestId } = render(<HomeScreen />);
      expect(getByTestId('device-bikepulse')).toBeTruthy();
    });

    it('does not show Bike pulse card when watch is the effective HR source', () => {
      Object.assign(mockConnection, { bikeConnected: true, watchAvailability: 'connected' });
      Object.assign(mockWatchHrControls, { watchAvailable: true, primary: 'watch', effectivePrimary: 'watch' });
      const { queryByTestId } = render(<HomeScreen />);
      expect(queryByTestId('device-bikepulse')).toBeNull();
    });
  });

  describe('Apple Watch HR device card', () => {
    it('shows the Apple Watch card when the watch is available and is the effective primary', () => {
      Object.assign(mockConnection, { watchAvailability: 'connected' });
      Object.assign(mockWatchHrControls, { watchAvailable: true, primary: 'watch', effectivePrimary: 'watch' });
      const { getByTestId } = render(<HomeScreen />);
      expect(getByTestId('device-watch')).toBeTruthy();
    });

    it('omits the Apple Watch row entirely when the Watch is not available', () => {
      Object.assign(mockWatchHrControls, { watchAvailable: false, primary: null, effectivePrimary: 'bike' });
      const { queryByTestId } = render(<HomeScreen />);
      expect(queryByTestId('device-watch')).toBeNull();
    });
  });
});
