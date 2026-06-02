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
  latestBikeMetrics: null,
  latestBluetoothHr: null,
  startScan: (...args) => mockStartScan(...args),
  stopScan: jest.fn(),
  selectDevice: jest.fn(),
  save: jest.fn(),
  reset: jest.fn(),
};

const mockGearSetupState: UseGearSetupMockState = { ...DEFAULT_MOCK_STATE };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  Stack: { Screen: () => null },
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
    fireEvent.press(getByText('Search for Smart Bike'));

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
        selectedDevice: { id: 'AB:CD', name: 'Garmin Venu' },
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
        selectedDevice: { id: 'AB:CD', name: 'Garmin Venu' },
        validationError: 'missing_hr_service',
      });

      const { getByText } = render(<GearSetupScreen target="hr" />);

      fireEvent.press(getByText('Pairing a Garmin or Polar watch?'));

      // The step text is intentionally family-agnostic: it names multiple
      // Garmin families with their distinct button paths rather than
      // collapsing them to a single "hold UP" instruction that is incorrect
      // for Venu / Vivoactive hardware. See the HR_BROADCAST_HINT constant
      // in GearSetupScreen.tsx.
      expect(getByText(/Open your watch/)).toBeTruthy();
      expect(getByText(/top-right button on Venu/)).toBeTruthy();
      expect(getByText(/Sensors & Accessories/)).toBeTruthy();
    });
  });

  it('shows the live hero with placeholders while awaiting a signal', () => {
    Object.assign(mockGearSetupState, {
      step: 'awaiting_signal',
      selectedDevice: { id: 'D4:9F', name: 'Wahoo KICKR Bike' },
      signalConfirmed: false,
    });
    const { getByText, getAllByText } = render(<GearSetupScreen target="bike" />);
    expect(getByText('Wahoo KICKR Bike')).toBeTruthy();
    expect(getByText('Waiting for signal…')).toBeTruthy();
    expect(getAllByText('—').length).toBe(4);
  });

  it('shows live metrics and enables save when the signal is confirmed', () => {
    Object.assign(mockGearSetupState, {
      step: 'ready',
      selectedDevice: { id: 'D4:9F', name: 'Wahoo KICKR Bike' },
      signalConfirmed: true,
      latestBikeMetrics: { speed: 31.4, cadence: 91, power: 124, distance: 200 },
    });
    const { getByText } = render(<GearSetupScreen target="bike" />);
    expect(getByText('124')).toBeTruthy();
    // Save fires persistence + back
    fireEvent.press(getByText('Use This Smart Bike'));
    expect(mockGearSetupState.save).toHaveBeenCalled();
  });

  it('shows the FTMS error callout and a Choose Another action on error', () => {
    Object.assign(mockGearSetupState, {
      step: 'error',
      selectedDevice: { id: 'X', name: 'Generic Fitness 5C2' },
      validationError: 'missing_indoor_bike_characteristic',
    });
    const { getByText } = render(<GearSetupScreen target="bike" />);
    expect(getByText(/does not broadcast indoor bike data/i)).toBeTruthy();
    fireEvent.press(getByText('Choose Another Bike'));
    expect(mockGearSetupState.reset).toHaveBeenCalled();
  });

  describe('HR sensor transparency', () => {
    it('does not surface any watch-specific guidance on HR gear setup in the default state', () => {
      // Regression guard: the HR gear-setup screen must treat chest straps
      // and broadcast-capable watches identically. Previously a "Garmin
      // Connect Tip" SectionCard with a dual-recording hint was rendered
      // unconditionally on target="hr"; it was removed because the HR source
      // type should be transparent to the user at gear-setup time.
      const { queryByText } = render(<GearSetupScreen target="hr" />);

      expect(queryByText('Want this workout in Garmin Connect too?')).toBeNull();
      expect(queryByText('Garmin Connect Tip')).toBeNull();
    });
  });
});
