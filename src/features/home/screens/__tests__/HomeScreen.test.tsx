import { render, fireEvent } from '@testing-library/react-native';

import { HomeScreen } from '../HomeScreen';

// ── Navigation ────────────────────────────────────────────────────────────────
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Safe area ─────────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// ── Hooks ─────────────────────────────────────────────────────────────────────
jest.mock('../../../../services/gear/gearStorage');

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

const mockConnection = {
  bikeConnected: false,
  hrConnected: false,
  latestBikeMetrics: null,
  latestHr: null,
  connectBike: jest.fn(),
  connectHr: jest.fn(),
  disconnectAll: jest.fn(),
};

const mockSavedGear = {
  savedBike: null as null | { id: string; name: string; type: 'bike' },
  savedHrSource: null as null | { id: string; name: string; type: 'hr' },
  hydrated: true,
  forgetBike: jest.fn(),
  forgetHr: jest.fn(),
};

const mockAutoReconnect = {
  bikeReconnectState: 'idle' as const,
  hrReconnectState: 'idle' as const,
  retryBike: jest.fn(),
  retryHr: jest.fn(),
};

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

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockSession, {
      phase: 'idle',
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
    });
    Object.assign(mockConnection, {
      bikeConnected: false,
      hrConnected: false,
      latestBikeMetrics: null,
      latestHr: null,
    });
    Object.assign(mockSavedGear, {
      savedBike: null,
      savedHrSource: null,
      hydrated: true,
    });
    Object.assign(mockAutoReconnect, {
      bikeReconnectState: 'idle',
      hrReconnectState: 'idle',
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<HomeScreen />)).not.toThrow();
  });

  it('shows the main sections', () => {
    const { getByText, getAllByText } = render(<HomeScreen />);

    expect(getByText('Quick Start')).toBeTruthy();
    expect(getByText('Resume Interrupted Session')).toBeTruthy();
    expect(getByText('My Bike')).toBeTruthy();
    expect(getAllByText('Heart Rate').length).toBeGreaterThan(0);
    expect(getByText('Start Training')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('shows Set Up Bike button when no bike is saved', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Set Up Bike')).toBeTruthy();
  });

  it('shows Add HR Source button when no HR is saved', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Add HR Source')).toBeTruthy();
  });

  it('shows saved bike name when bike is saved', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Zipro Rave')).toBeTruthy();
  });

  it('enables Start Training only when the bike is connected', () => {
    const { getByText, rerender } = render(<HomeScreen />);

    fireEvent.press(getByText('Start Training'));
    expect(mockPush).not.toHaveBeenCalled();

    Object.assign(mockConnection, { bikeConnected: true });
    rerender(<HomeScreen />);

    fireEvent.press(getByText('Start Training'));
    expect(mockPush).toHaveBeenCalledWith('/training');
  });

  it('keeps training entry disabled once the session is finished', () => {
    Object.assign(mockConnection, { bikeConnected: true });
    Object.assign(mockSession, { phase: 'finished' });

    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('Start Training'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows Resume Training and the interrupted workout CTA when the session is paused', () => {
    Object.assign(mockConnection, { bikeConnected: true });
    Object.assign(mockSession, { phase: 'paused', elapsedSeconds: 305, totalDistance: 2400 });

    const { getByText, queryByText } = render(<HomeScreen />);

    expect(getByText('Resume Training')).toBeTruthy();
    expect(getByText('Resume Workout')).toBeTruthy();
    expect(queryByText('No interrupted workout is ready to resume right now.')).toBeNull();
  });

  it('shows empty state when there is no resumable workout', () => {
    const { getByText, queryByText } = render(<HomeScreen />);

    expect(getByText('No interrupted workout is ready to resume right now.')).toBeTruthy();
    expect(queryByText('Resume Workout')).toBeNull();
  });

  it('navigates to history and settings from Quick Start', () => {
    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('History'));
    fireEvent.press(getByText('Settings'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/history');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/settings');
  });

  it('navigates to gear setup when Set Up Bike is pressed', () => {
    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('Set Up Bike'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=bike');
  });

  it('shows Retry / Choose Another / Forget when bike reconnect fails', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    Object.assign(mockAutoReconnect, { bikeReconnectState: 'failed' });

    const { getByText } = render(<HomeScreen />);

    expect(getByText('Retry')).toBeTruthy();
    expect(getByText('Choose Another')).toBeTruthy();
    expect(getByText('Forget')).toBeTruthy();
  });

  it('calls retryBike when Retry is pressed', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    Object.assign(mockAutoReconnect, { bikeReconnectState: 'failed' });

    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Retry'));

    expect(mockAutoReconnect.retryBike).toHaveBeenCalled();
  });
});
