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

jest.mock('../../../training/hooks/useDeviceConnection', () => ({
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

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<HomeScreen />)).not.toThrow();
  });

  it('shows the scan button', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Start Scan')).toBeTruthy();
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
