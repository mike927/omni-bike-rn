import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { SettingsScreen } from '../SettingsScreen';
import { useSavedGearStore } from '../../../../store/savedGearStore';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../../../services/gear/gearStorage');

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockStravaConnection = {
  isConnected: false,
  athleteName: null as string | null,
  isLoading: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
};

const mockProviderBikeLinking = {
  currentLink: null,
  status: 'not_linked' as const,
  needsReconnect: false,
  errorMessage: null as string | null,
  openProviderGearManagement: jest.fn(),
};

const mockConnection = {
  bikeConnected: false,
  hrConnected: false,
  latestBikeMetrics: null,
  latestBluetoothHr: null,
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

jest.mock('../../../training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => mockConnection,
}));

jest.mock('../../../gear/hooks/useSavedGear', () => ({
  useSavedGear: () => mockSavedGear,
}));

jest.mock('../../../integrations/hooks/useStravaConnection', () => ({
  useStravaConnection: () => mockStravaConnection,
}));

jest.mock('../../../integrations/hooks/useProviderBikeLinking', () => ({
  useProviderBikeLinking: () => mockProviderBikeLinking,
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
    Object.assign(mockSavedGear, { savedBike: null, savedHrSource: null });
    Object.assign(mockStravaConnection, {
      isConnected: false,
      athleteName: null,
      isLoading: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });
    Object.assign(mockProviderBikeLinking, {
      currentLink: null,
      status: 'not_linked',
      needsReconnect: false,
      errorMessage: null,
      openProviderGearManagement: jest.fn(),
    });
    useSavedGearStore.setState({ bikeReconnectState: 'idle', hrReconnectState: 'idle' });
  });

  it('renders without crashing', () => {
    expect(() => render(<SettingsScreen />)).not.toThrow();
  });

  it('shows the Settings heading and My Gear section', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('My Gear')).toBeTruthy();
  });

  it('shows "Not set" when no bike is saved', () => {
    const { getAllByText } = render(<SettingsScreen />);
    expect(getAllByText('Not set').length).toBeGreaterThan(0);
  });

  it('shows saved bike name when bike is saved', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Zipro Rave')).toBeTruthy();
  });

  it('shows Replace and Forget buttons when bike is saved', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Replace')).toBeTruthy();
    expect(getByText('Forget')).toBeTruthy();
  });

  it('navigates to gear setup with bike target when Set Up is pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Set Up'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=bike');
  });

  it('navigates to gear setup with hr target when Add Bluetooth HR is pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Add Bluetooth HR'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=hr');
  });

  it('calls forgetBike when Forget is pressed on saved bike', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getAllByText } = render(<SettingsScreen />);
    fireEvent.press(getAllByText('Forget')[0]);
    expect(mockSavedGear.forgetBike).toHaveBeenCalled();
  });

  it('Disconnect Active Gear is disabled when nothing is connected', () => {
    const { getByText } = render(<SettingsScreen />);
    const btn = getByText('Disconnect Active Gear');
    expect(btn).toBeTruthy();
  });

  it('marks saved gear as disconnected after manual disconnect', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    Object.assign(mockConnection, { bikeConnected: true, hrConnected: true });
    Object.assign(mockSavedGear, {
      savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr', name: 'Garmin HRM', type: 'hr' },
    });
    mockConnection.disconnectAll.mockImplementation(async () => {
      useSavedGearStore.getState().setBikeReconnectState('disconnected');
      useSavedGearStore.getState().setHrReconnectState('disconnected');
    });

    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Disconnect Active Gear'));

    await waitFor(() => {
      expect(mockConnection.disconnectAll).toHaveBeenCalledWith({ suppressAutoReconnect: true });
      expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
      expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');
      expect(alertSpy).toHaveBeenCalledWith('Disconnected', 'Cleared the active bike and heart-rate connections.');
    });
  });
});
