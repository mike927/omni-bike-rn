import { fireEvent, render } from '@testing-library/react-native';

import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../../training/navigation/trainingSummaryRoute';
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

jest.mock('../../../gear/hooks/useAutoReconnect');
jest.mock('../../../gear/hooks/useSavedGear');
jest.mock('../../../training/hooks/useTrainingSession');
jest.mock('../../../training/hooks/useDeviceConnection');

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
      phase: 'idle',
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

  it('renders the home sections', () => {
    const { getByText, queryByText } = render(<HomeScreen />);

    expect(getByText('Quick Start')).toBeTruthy();
    expect(getByText('Bike')).toBeTruthy();
    expect(getByText('Heart Rate')).toBeTruthy();
    expect(getByText('Latest Workout')).toBeTruthy();
    expect(queryByText(/Latest reading:/)).toBeNull();
    expect(queryByText(/Current training state:/)).toBeNull();
    expect(queryByText('Interrupted Session')).toBeNull();
    expect(queryByText('History')).toBeNull();
  });

  it('does not render gear management buttons on the Bike or HR cards', () => {
    const { queryByText } = render(<HomeScreen />);

    expect(queryByText('Set Up Bike')).toBeNull();
    expect(queryByText('Add Bluetooth HR')).toBeNull();
    expect(queryByText('Forget')).toBeNull();
    expect(queryByText('Retry')).toBeNull();
    expect(queryByText('Choose Another')).toBeNull();
  });

  it('navigates to Settings when the Bike card is pressed', () => {
    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('Bike'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('navigates to Settings when the Heart Rate card is pressed', () => {
    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('Heart Rate'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('shows the bike connection status', () => {
    Object.assign(mockSavedGear, {
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
    });
    Object.assign(mockConnection, { bikeConnected: true });

    const { getByText } = render(<HomeScreen />);

    expect(getByText('Zipro Rave')).toBeTruthy();
    expect(getByText('Connected')).toBeTruthy();
  });

  it('shows the Bluetooth HR source name and connection status when saved and connected', () => {
    Object.assign(mockSavedGear, {
      savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' },
    });
    Object.assign(mockConnection, { hrConnected: true });

    const { getByText } = render(<HomeScreen />);

    expect(getByText('Polar H10 · Connected')).toBeTruthy();
  });

  it('shows Not set for Bluetooth HR when no source is saved', () => {
    // Give the bike a name so the only "Not set" is the Bluetooth HR row.
    Object.assign(mockSavedGear, { savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' } });

    const { getByText } = render(<HomeScreen />);

    expect(getByText('Not set')).toBeTruthy();
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

    expect(getByText('Interrupted Session')).toBeTruthy();

    fireEvent.press(getByText('Resume'));
    expect(resumeInterruptedSession).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/training');
  });

  it('keeps Start Training disabled until the bike is connected', () => {
    const { getByText, rerender } = render(<HomeScreen />);

    fireEvent.press(getByText('Start Training'));
    expect(mockPush).not.toHaveBeenCalled();

    Object.assign(mockConnection, { bikeConnected: true });
    rerender(<HomeScreen />);

    fireEvent.press(getByText('Start Training'));
    expect(mockPush).toHaveBeenCalledWith('/training');
  });

  it('shows Resume Training when a workout is already active', () => {
    Object.assign(mockConnection, { bikeConnected: true });
    Object.assign(mockSession, { phase: 'paused' });

    const { getByText } = render(<HomeScreen />);

    expect(getByText('Resume Training')).toBeTruthy();
  });

  it('shows the latest workout card and routes to its summary', () => {
    mockLatestWorkoutHook.mockReturnValue({
      id: 'session-42',
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

    const { getByText } = render(<HomeScreen />);

    expect(getByText('View Summary')).toBeTruthy();

    fireEvent.press(getByText('View Summary'));
    expect(mockPush).toHaveBeenCalledWith(
      buildTrainingSummaryRoute('session-42', SAVED_SESSION_TRAINING_SUMMARY_SOURCE, '/'),
    );
  });

  it('shows an empty latest workout state when nothing is saved yet', () => {
    const { getByText } = render(<HomeScreen />);

    expect(getByText('Complete a ride to see your latest workout summary here.')).toBeTruthy();
  });

  describe('Apple Watch HR status line', () => {
    it('shows the Apple Watch status line when the Watch is available and primary is watch', () => {
      Object.assign(mockConnection, { watchAvailability: 'idle' });
      Object.assign(mockWatchHrControls, { watchAvailable: true, primary: 'watch' });

      const { getByText } = render(<HomeScreen />);

      expect(getByText('Idle')).toBeTruthy();
    });

    it('shows Disabled on the line when primary is not watch', () => {
      Object.assign(mockConnection, { watchAvailability: 'idle' });
      Object.assign(mockWatchHrControls, { watchAvailable: true, primary: null });

      const { getByText } = render(<HomeScreen />);

      expect(getByText('Disabled')).toBeTruthy();
    });

    it('omits the Apple Watch row entirely when the Watch is not available', () => {
      Object.assign(mockWatchHrControls, { watchAvailable: false, primary: null });

      const { queryByText } = render(<HomeScreen />);

      expect(queryByText('Apple Watch')).toBeNull();
    });
  });
});
