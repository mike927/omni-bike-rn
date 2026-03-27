import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { GearSetupScreen } from '../GearSetupScreen';

const mockBack = jest.fn();
const mockOpenSettings = jest.fn();
const mockStartScan = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openSettings: mockOpenSettings,
}));

jest.mock('../../hooks/useGearSetup', () => ({
  useGearSetup: () => ({
    step: 'scanning',
    devices: [],
    isScanning: false,
    scanError: null,
    selectedDevice: null,
    validationError: null,
    signalConfirmed: false,
    startScan: mockStartScan,
    stopScan: jest.fn(),
    selectDevice: jest.fn(),
    save: jest.fn(),
    reset: jest.fn(),
  }),
}));

describe('GearSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartScan.mockResolvedValue('granted');
  });

  it('shows the Bluetooth permission alert when scanning is denied', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockStartScan.mockResolvedValue('denied');

    const { getByText } = render(<GearSetupScreen target="bike" />);
    fireEvent.press(getByText('Start Scan'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Bluetooth Permission Required',
        'Allow Omni Bike to access Bluetooth in Settings.',
        expect.any(Array),
      );
    });
  });
});
