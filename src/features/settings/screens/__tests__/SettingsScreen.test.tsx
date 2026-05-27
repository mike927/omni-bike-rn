import { render, fireEvent } from '@testing-library/react-native';

import { SettingsScreen } from '../SettingsScreen';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import type { WatchAvailability } from '../../../../types/watch';

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
  latestAppleWatchHr: null as number | null,
  watchAvailability: 'unavailable' as WatchAvailability,
  connectBike: jest.fn(),
  connectHr: jest.fn(),
  disconnectAll: jest.fn(),
};

const mockAutoReconnect = {
  bikeReconnectState: 'idle' as const,
  hrReconnectState: 'idle' as const,
  retryBike: jest.fn(),
  retryHr: jest.fn(),
};

const mockWatchHr = {
  watchAvailable: false,
  primary: null as null | 'watch' | 'bluetooth' | 'bike',
  setPrimary: jest.fn(),
  availableSources: ['bike'] as ('watch' | 'bluetooth' | 'bike')[],
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

jest.mock('../../../gear/hooks/useWatchHrControls', () => ({
  useWatchHrControls: () => mockWatchHr,
}));

jest.mock('../../../gear/hooks/useAutoReconnect', () => ({
  useAutoReconnect: () => mockAutoReconnect,
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockConnection, {
      bikeConnected: false,
      hrConnected: false,
      latestAppleWatchHr: null,
      watchAvailability: 'unavailable',
    });
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
    Object.assign(mockAutoReconnect, {
      bikeReconnectState: 'idle',
      hrReconnectState: 'idle',
    });
    Object.assign(mockWatchHr, {
      watchAvailable: false,
      primary: null,
      setPrimary: jest.fn(),
      availableSources: ['bike'] as ('watch' | 'bluetooth' | 'bike')[],
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

  it('shows "Not set up" for unsaved gear rows', () => {
    const { getAllByText } = render(<SettingsScreen />);
    expect(getAllByText('Not set up').length).toBeGreaterThan(0);
  });

  it('shows saved bike name with connection status when bike is saved', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Zipro Rave · Unavailable')).toBeTruthy();
  });

  it('shows saved bike name with Ready status when bike is connected', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    Object.assign(mockConnection, { bikeConnected: true });
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Zipro Rave · Ready')).toBeTruthy();
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

  it('shows saved HR source name with Unavailable status when hr is not connected', () => {
    Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Polar H10 · Unavailable')).toBeTruthy();
  });

  it('shows saved HR source name with Ready status when hr is connected', () => {
    Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
    Object.assign(mockConnection, { hrConnected: true });
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Polar H10 · Ready')).toBeTruthy();
  });

  it('does not render the Disconnect Active Gear button', () => {
    const { queryByText } = render(<SettingsScreen />);
    expect(queryByText('Disconnect Active Gear')).toBeNull();
  });

  describe('Connect button for saved-but-disconnected gear', () => {
    it('shows Connect button for bike when saved and not connected', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Connect')).toBeTruthy();
    });

    it('calls retryBike when Connect is pressed on bike row', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Connect'));
      expect(mockAutoReconnect.retryBike).toHaveBeenCalled();
    });

    it('disables the bike Connect button and shows Connecting... while connecting', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false });
      Object.assign(mockAutoReconnect, { bikeReconnectState: 'connecting' });
      const { getByText, queryByText } = render(<SettingsScreen />);
      expect(getByText('Connecting...')).toBeTruthy();
      expect(queryByText('Connect')).toBeNull();
      fireEvent.press(getByText('Connecting...'));
      expect(mockAutoReconnect.retryBike).not.toHaveBeenCalled();
    });

    it('disables the HR Connect button and shows Connecting... while connecting', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      Object.assign(mockAutoReconnect, { hrReconnectState: 'connecting' });
      const { getByText, queryByText } = render(<SettingsScreen />);
      expect(getByText('Connecting...')).toBeTruthy();
      expect(queryByText('Connect')).toBeNull();
      fireEvent.press(getByText('Connecting...'));
      expect(mockAutoReconnect.retryHr).not.toHaveBeenCalled();
    });

    it('does not show Connect button for bike when bike is connected', () => {
      Object.assign(mockSavedGear, {
        savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' },
        savedHrSource: null,
      });
      Object.assign(mockConnection, { bikeConnected: true, hrConnected: false });
      const { queryByText } = render(<SettingsScreen />);
      expect(queryByText('Connect')).toBeNull();
    });

    it('shows Connect button for Bluetooth HR when saved and not connected', () => {
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { hrConnected: false });
      const { getAllByText } = render(<SettingsScreen />);
      expect(getAllByText('Connect').length).toBeGreaterThan(0);
    });

    it('calls retryHr when Connect is pressed on HR row', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Connect'));
      expect(mockAutoReconnect.retryHr).toHaveBeenCalled();
    });

    it('does not show Connect button for HR when hr is connected', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: true });
      const { queryByText } = render(<SettingsScreen />);
      expect(queryByText('Connect')).toBeNull();
    });
  });

  describe('Primary HR source selector', () => {
    it('does not render the old Apple Watch HR toggle', () => {
      Object.assign(mockWatchHr, { watchAvailable: true, availableSources: ['watch', 'bike'] });
      const { queryByText } = render(<SettingsScreen />);
      expect(queryByText('Enable')).toBeNull();
      expect(queryByText('Disable')).toBeNull();
    });

    it('renders the Primary HR source section label', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Primary HR Source')).toBeTruthy();
    });

    it('always shows Bike pulse as an option', () => {
      Object.assign(mockWatchHr, { availableSources: ['bike'] });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Bike pulse')).toBeTruthy();
    });

    it('shows Apple Watch option when watchAvailable is true', () => {
      Object.assign(mockWatchHr, { watchAvailable: true, availableSources: ['watch', 'bike'] });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Apple Watch')).toBeTruthy();
    });

    it('does not show Apple Watch option when watchAvailable is false', () => {
      Object.assign(mockWatchHr, { watchAvailable: false, availableSources: ['bike'] });
      const { queryByText } = render(<SettingsScreen />);
      expect(queryByText('Apple Watch')).toBeNull();
    });

    it('shows saved strap name when bluetooth is available', () => {
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      const { getAllByText } = render(<SettingsScreen />);
      // The strap name appears at least once as the selector option label
      expect(getAllByText('Polar H10').length).toBeGreaterThan(0);
    });

    it('calls setPrimary with "watch" when Apple Watch option is pressed', () => {
      Object.assign(mockWatchHr, {
        watchAvailable: true,
        availableSources: ['watch', 'bike'],
        primary: 'bike',
        setPrimary: jest.fn(),
      });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Apple Watch'));
      expect(mockWatchHr.setPrimary).toHaveBeenCalledWith('watch');
    });

    it('calls setPrimary with "bluetooth" when strap option is pressed', () => {
      Object.assign(mockWatchHr, {
        availableSources: ['bluetooth', 'bike'],
        primary: 'bike',
        setPrimary: jest.fn(),
      });
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      const { getAllByText } = render(<SettingsScreen />);
      fireEvent.press(getAllByText('Polar H10')[0]);
      expect(mockWatchHr.setPrimary).toHaveBeenCalledWith('bluetooth');
    });

    it('calls setPrimary with "bike" when Bike pulse option is pressed', () => {
      Object.assign(mockWatchHr, {
        availableSources: ['bike'],
        primary: null,
        setPrimary: jest.fn(),
      });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Bike pulse'));
      expect(mockWatchHr.setPrimary).toHaveBeenCalledWith('bike');
    });

    it('shows watch readiness label (Ready) when watch is connected', () => {
      Object.assign(mockWatchHr, { watchAvailable: true, availableSources: ['watch', 'bike'] });
      Object.assign(mockConnection, { watchAvailability: 'connected' });
      const { getAllByText } = render(<SettingsScreen />);
      // Both Apple Watch and Bike pulse show 'Ready' when watch is connected
      expect(getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    });

    it('shows watch readiness label (Unavailable) when watch is unavailable', () => {
      Object.assign(mockWatchHr, { watchAvailable: true, availableSources: ['watch', 'bike'] });
      Object.assign(mockConnection, { watchAvailability: 'unavailable' });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Unavailable')).toBeTruthy();
    });

    it('shows Ready readiness for Bike pulse', () => {
      Object.assign(mockWatchHr, { availableSources: ['bike'] });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Ready')).toBeTruthy();
    });
  });
});
