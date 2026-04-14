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

  it('renders the simplified home sections', () => {
    const { getByText, queryByText } = render(<HomeScreen />);

    expect(getByText('Quick Start')).toBeTruthy();
    expect(getByText('Bike')).toBeTruthy();
    expect(getByText('HR Source')).toBeTruthy();
    expect(getByText('Latest Workout')).toBeTruthy();
    expect(queryByText(/Latest reading:/)).toBeNull();
    expect(queryByText(/Current training state:/)).toBeNull();
    expect(queryByText('Interrupted Session')).toBeNull();
    expect(queryByText('History')).toBeNull();
    expect(queryByText('Settings')).toBeNull();
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

  it('shows setup actions when no bike or HR source is saved', () => {
    const { getByText } = render(<HomeScreen />);

    expect(getByText('Set Up Bike')).toBeTruthy();
    expect(getByText('Add Bluetooth HR')).toBeTruthy();
  });

  it('shows reconnect actions when the saved bike reconnect failed', () => {
    Object.assign(mockSavedGear, {
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
    });
    Object.assign(mockAutoReconnect, { bikeReconnectState: 'failed' });

    const { getByText } = render(<HomeScreen />);

    expect(getByText('Retry')).toBeTruthy();
    expect(getByText('Choose Another')).toBeTruthy();
    expect(getByText('Forget')).toBeTruthy();
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
});
