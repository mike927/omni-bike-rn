import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

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
const mockRequestBlePermission = jest.fn();
jest.mock('../../../devices/hooks/useBlePermission', () => ({
  useBlePermission: () => ({
    status: 'unknown',
    requestBlePermission: mockRequestBlePermission,
  }),
}));

const mockScanForDevices = jest.fn();
const mockStopScanning = jest.fn();
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

jest.mock('../../../devices/hooks/useBleScanner', () => ({
  useBleScanner: () => ({
    devices: [],
    isScanning: false,
    error: null,
    scanForDevices: mockScanForDevices,
    stopScanning: mockStopScanning,
  }),
}));

jest.mock('../../../training/hooks/useTrainingSession', () => ({
  useTrainingSession: () => mockSession,
}));

jest.mock('../../../training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => mockConnection,
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockSession, {
      phase: 'idle',
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null },
    });
    Object.assign(mockConnection, {
      bikeConnected: false,
      hrConnected: false,
      latestBikeMetrics: null,
      latestHr: null,
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<HomeScreen />)).not.toThrow();
  });

  it('shows the scan button', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Start Scan')).toBeTruthy();
  });

  it('shows the functional home sections and entry points', () => {
    const { getByText, getAllByText } = render(<HomeScreen />);

    expect(getByText('Quick Start')).toBeTruthy();
    expect(getByText('Resume Interrupted Session')).toBeTruthy();
    expect(getByText('My Bike')).toBeTruthy();
    expect(getAllByText('Heart Rate').length).toBeGreaterThan(0);
    expect(getByText('Start Training')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
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
    Object.assign(mockSession, {
      phase: 'paused',
      elapsedSeconds: 305,
      totalDistance: 2400,
    });

    const { getByText, queryByText } = render(<HomeScreen />);

    expect(getByText('Resume Training')).toBeTruthy();
    expect(getByText('Resume Workout')).toBeTruthy();
    expect(queryByText('No interrupted workout is ready to resume right now.')).toBeNull();
  });

  it('shows an interrupted-session empty state when there is no resumable workout', () => {
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

  it('calls requestBlePermission before scanForDevices when permission is granted', async () => {
    mockRequestBlePermission.mockResolvedValue('granted');

    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Start Scan'));

    await waitFor(() => {
      expect(mockRequestBlePermission).toHaveBeenCalledTimes(1);
      expect(mockScanForDevices).toHaveBeenCalledTimes(1);
    });
  });

  it('shows a permission alert and does not scan when permission is denied', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRequestBlePermission.mockResolvedValue('denied');

    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Start Scan'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Bluetooth Permission Required', expect.any(String), expect.any(Array));
    });

    expect(mockScanForDevices).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('alert denied action opens iOS Settings', async () => {
    const linkingSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const openSettingsButton = buttons?.find((b) => b.text === 'Open Settings');
      openSettingsButton?.onPress?.();
    });
    mockRequestBlePermission.mockResolvedValue('denied');

    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Start Scan'));

    await waitFor(() => {
      expect(linkingSpy).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
    linkingSpy.mockRestore();
  });
});
