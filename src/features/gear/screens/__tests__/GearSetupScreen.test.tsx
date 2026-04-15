import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { GearSetupScreen } from '../GearSetupScreen';
import type { UseGearSetupMockState } from './useGearSetup.mock';

const mockBack = jest.fn();
const mockOpenSettings = jest.fn();
const mockStartScan = jest.fn();

const DEFAULT_MOCK_STATE: UseGearSetupMockState = {
  step: 'scanning',
  devices: [],
  isScanning: false,
  scanError: null,
  selectedDevice: null,
  validationError: null,
  signalConfirmed: false,
  startScan: (...args) => mockStartScan(...args),
  stopScan: jest.fn(),
  selectDevice: jest.fn(),
  save: jest.fn(),
  reset: jest.fn(),
};

const mockGearSetupState: UseGearSetupMockState = { ...DEFAULT_MOCK_STATE };

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
  useGearSetup: () => mockGearSetupState,
}));

describe('GearSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockGearSetupState, DEFAULT_MOCK_STATE);
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

  describe('HR broadcast hint', () => {
    it('shows the Garmin/Polar broadcast hint when HR validation fails with missing_hr_service', () => {
      Object.assign(mockGearSetupState, {
        step: 'error',
        validationError: 'missing_hr_service',
      });

      const { getByText, queryByText } = render(<GearSetupScreen target="hr" />);

      expect(getByText('Pairing a Garmin or Polar watch?')).toBeTruthy();
      // Step list is collapsed by default — step 1 text should not be visible yet.
      expect(queryByText(/hold UP to open the menu/)).toBeNull();
    });

    it('expands the broadcast hint step list when tapped', () => {
      Object.assign(mockGearSetupState, {
        step: 'error',
        validationError: 'missing_hr_service',
      });

      const { getByText } = render(<GearSetupScreen target="hr" />);

      fireEvent.press(getByText('Pairing a Garmin or Polar watch?'));

      expect(getByText(/hold UP to open the menu/)).toBeTruthy();
      expect(getByText(/Sensors & Accessories/)).toBeTruthy();
    });
  });

  describe('Dual-recording info block', () => {
    it('renders the dual-recording info block on HR gear setup in collapsed state', () => {
      const { getByText, queryByText } = render(<GearSetupScreen target="hr" />);

      expect(getByText('Want this workout in Garmin Connect too?')).toBeTruthy();
      // Flow 1 / Flow 2 body text should not be visible while collapsed.
      expect(queryByText(/Flow 1 — HR sensor only/)).toBeNull();
      expect(queryByText(/Flow 2 — Dual recording/)).toBeNull();
    });

    it('does not render the dual-recording info block on bike gear setup', () => {
      const { queryByText } = render(<GearSetupScreen target="bike" />);

      expect(queryByText('Want this workout in Garmin Connect too?')).toBeNull();
    });
  });
});
