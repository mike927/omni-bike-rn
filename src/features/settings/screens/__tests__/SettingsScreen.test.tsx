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

  it('shows saved bike name and Unavailable status when bike is saved and not connected', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText, getAllByText } = render(<SettingsScreen />);
    expect(getByText('Zipro Rave')).toBeTruthy();
    expect(getAllByText('Unavailable').length).toBeGreaterThan(0);
  });

  it('shows saved bike name and Ready status when bike is connected', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    Object.assign(mockConnection, { bikeConnected: true });
    const { getByText, getAllByText } = render(<SettingsScreen />);
    expect(getByText('Zipro Rave')).toBeTruthy();
    expect(getAllByText('Ready').length).toBeGreaterThan(0);
  });

  it('shows Replace and Forget buttons for bike after expanding the tile', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText, queryByText } = render(<SettingsScreen />);
    // Collapsed by default — buttons not in tree
    expect(queryByText('Replace')).toBeNull();
    expect(queryByText('Forget')).toBeNull();
    fireEvent.press(getByText('Zipro Rave'));
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

  it('calls forgetBike when Forget is pressed on saved bike (after expanding tile)', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Zipro Rave'));
    fireEvent.press(getByText('Forget'));
    expect(mockSavedGear.forgetBike).toHaveBeenCalled();
  });

  it('shows saved HR source name in the HR source row with Unavailable readiness when hr is not connected', () => {
    Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
    Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
    const { getByText, getAllByText } = render(<SettingsScreen />);
    expect(getByText('Polar H10')).toBeTruthy();
    expect(getAllByText('Unavailable').length).toBeGreaterThan(0);
  });

  it('shows saved HR source name in the HR source row with Ready readiness when hr is connected', () => {
    Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
    Object.assign(mockConnection, { hrConnected: true });
    Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
    const { getAllByText } = render(<SettingsScreen />);
    expect(getAllByText('Polar H10').length).toBeGreaterThan(0);
    expect(getAllByText('Ready').length).toBeGreaterThan(0);
  });

  it('does not render the Disconnect Active Gear button', () => {
    const { queryByText } = render(<SettingsScreen />);
    expect(queryByText('Disconnect Active Gear')).toBeNull();
  });

  describe('Connect button for saved-but-disconnected gear', () => {
    it('shows Connect button for bike when saved and not connected (after expanding tile)', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false });
      const { getByText } = render(<SettingsScreen />);
      // Expand the bike tile first
      fireEvent.press(getByText('Zipro Rave'));
      expect(getByText('Connect')).toBeTruthy();
    });

    it('calls retryBike when Connect is pressed on bike row (after expanding tile)', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      const { getByText } = render(<SettingsScreen />);
      // Expand the bike tile first
      fireEvent.press(getByText('Zipro Rave'));
      fireEvent.press(getByText('Connect'));
      expect(mockAutoReconnect.retryBike).toHaveBeenCalled();
    });

    it('disables the bike Connect button and shows Connecting... while connecting (after expanding tile)', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false });
      Object.assign(mockAutoReconnect, { bikeReconnectState: 'connecting' });
      const { getAllByText, queryByText } = render(<SettingsScreen />);
      // Expand the bike tile first
      fireEvent.press(getAllByText('Zipro Rave')[0]);
      // Both the tile status and the action button show "Connecting..."
      expect(getAllByText('Connecting...').length).toBeGreaterThanOrEqual(1);
      expect(queryByText('Connect')).toBeNull();
      expect(mockAutoReconnect.retryBike).not.toHaveBeenCalled();
    });

    it('disables the HR Connect button and shows Connecting... while connecting (after expanding chevron)', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      Object.assign(mockAutoReconnect, { hrReconnectState: 'connecting' });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText, queryByText, getByTestId } = render(<SettingsScreen />);
      // Expand the HR strap chevron first
      fireEvent.press(getByTestId('hr-strap-chevron'));
      expect(getByText('Connecting...')).toBeTruthy();
      expect(queryByText('Connect')).toBeNull();
      fireEvent.press(getByText('Connecting...'));
      expect(mockAutoReconnect.retryHr).not.toHaveBeenCalled();
    });

    it('does not show Connect button for bike when bike is connected (even after expanding tile)', () => {
      Object.assign(mockSavedGear, {
        savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' },
        savedHrSource: null,
      });
      Object.assign(mockConnection, { bikeConnected: true, hrConnected: false });
      const { getByText, queryByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Zipro Rave'));
      expect(queryByText('Connect')).toBeNull();
    });

    it('shows Connect button for Bluetooth HR when saved and not connected (after expanding chevron)', () => {
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { hrConnected: false });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getAllByText, getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('hr-strap-chevron'));
      expect(getAllByText('Connect').length).toBeGreaterThan(0);
    });

    it('calls retryHr when Connect is pressed on HR source row (after expanding chevron)', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText, getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('hr-strap-chevron'));
      fireEvent.press(getByText('Connect'));
      expect(mockAutoReconnect.retryHr).toHaveBeenCalled();
    });

    it('does not show Connect button for HR when hr is connected (even after expanding chevron)', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: true });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { queryByText, getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('hr-strap-chevron'));
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

    it('renders the Heart Rate Source section label', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Heart Rate Source')).toBeTruthy();
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
      Object.assign(mockConnection, { watchAvailability: 'unavailable', bikeConnected: false });
      const { getAllByText } = render(<SettingsScreen />);
      // Watch shows Unavailable; bike also shows Unavailable when not connected
      expect(getAllByText('Unavailable').length).toBeGreaterThanOrEqual(1);
    });

    it('shows Ready readiness for Bike pulse when bike is connected', () => {
      Object.assign(mockWatchHr, { availableSources: ['bike'] });
      Object.assign(mockConnection, { bikeConnected: true });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Ready')).toBeTruthy();
    });

    it('shows Unavailable readiness for Bike pulse when bike is not connected', () => {
      Object.assign(mockWatchHr, { availableSources: ['bike'] });
      Object.assign(mockConnection, { bikeConnected: false });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Unavailable')).toBeTruthy();
    });
  });

  describe('My Gear — role-based layout', () => {
    it('strap name appears exactly once when saved strap is in availableSources', () => {
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' } });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'], primary: 'bluetooth' });
      const { getAllByText } = render(<SettingsScreen />);
      // Name must appear exactly once — no duplicate standalone management row
      expect(getAllByText('HRM-Dual:031993').length).toBe(1);
    });

    it('bluetooth HR source row shows Replace and Forget after tapping chevron (collapsed by default)', () => {
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' } });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText, queryByText, getByTestId } = render(<SettingsScreen />);
      // Collapsed by default
      expect(queryByText('Replace')).toBeNull();
      expect(queryByText('Forget')).toBeNull();
      // Expand via chevron
      fireEvent.press(getByTestId('hr-strap-chevron'));
      expect(getByText('Replace')).toBeTruthy();
      expect(getByText('Forget')).toBeTruthy();
    });

    it('pressing Forget on the HR source row (after chevron expand) calls forgetHr and does NOT call setPrimary', () => {
      Object.assign(mockSavedGear, {
        savedBike: null,
        savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' },
      });
      Object.assign(mockWatchHr, {
        availableSources: ['bluetooth', 'bike'],
        primary: 'bluetooth',
        setPrimary: jest.fn(),
      });
      const { getByText, getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('hr-strap-chevron'));
      fireEvent.press(getByText('Forget'));
      expect(mockSavedGear.forgetHr).toHaveBeenCalled();
      expect(mockWatchHr.setPrimary).not.toHaveBeenCalled();
    });

    it('bluetooth HR source row shows Connect (after chevron expand) when strap saved but disconnected; pressing Connect calls retryHr', () => {
      Object.assign(mockSavedGear, {
        savedBike: null,
        savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' },
      });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText, getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('hr-strap-chevron'));
      expect(getByText('Connect')).toBeTruthy();
      fireEvent.press(getByText('Connect'));
      expect(mockAutoReconnect.retryHr).toHaveBeenCalled();
    });

    it('shows Add Bluetooth HR button (not bluetooth row) when no strap is saved; pressing it routes to gear-setup?target=hr', () => {
      Object.assign(mockSavedGear, { savedHrSource: null });
      Object.assign(mockWatchHr, { availableSources: ['bike'] });
      const { getByText, queryByText } = render(<SettingsScreen />);
      // No bluetooth row label (strap name absent)
      expect(queryByText('HRM-Dual:031993')).toBeNull();
      // Add Bluetooth HR present
      expect(getByText('Add Bluetooth HR')).toBeTruthy();
      fireEvent.press(getByText('Add Bluetooth HR'));
      expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=hr');
    });

    it('Apple Watch and Bike pulse HR source rows have no chevron and no management action buttons', () => {
      // Render with all sources; only the bluetooth tile has a chevron.
      Object.assign(mockSavedGear, {
        savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' },
      });
      Object.assign(mockConnection, { hrConnected: true });
      Object.assign(mockWatchHr, {
        watchAvailable: true,
        availableSources: ['watch', 'bluetooth', 'bike'],
        primary: 'bluetooth',
      });
      const { getByTestId, queryByTestId, queryByText } = render(<SettingsScreen />);
      // Management buttons not in tree (collapsed)
      expect(queryByText('Replace')).toBeNull();
      expect(queryByText('Forget')).toBeNull();
      // No chevrons for watch or bike-pulse
      expect(queryByTestId('hr-watch-chevron')).toBeNull();
      expect(queryByTestId('hr-bike-chevron')).toBeNull();
      // The strap chevron exists
      expect(getByTestId('hr-strap-chevron')).toBeTruthy();
    });

    it('selecting an HR source row calls setPrimary with the correct source', () => {
      Object.assign(mockWatchHr, {
        watchAvailable: true,
        availableSources: ['watch', 'bluetooth', 'bike'],
        primary: 'bike',
        setPrimary: jest.fn(),
      });
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' } });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Apple Watch'));
      expect(mockWatchHr.setPrimary).toHaveBeenCalledWith('watch');
    });

    // --- New spec tests (tap-to-select accent bar + chevron-expand) ---

    it('bike tile is collapsed by default (buttons not in tree)', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      const { queryByText } = render(<SettingsScreen />);
      expect(queryByText('Replace')).toBeNull();
      expect(queryByText('Forget')).toBeNull();
    });

    it('bike tile expands on tap and collapses on second tap', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      const { getByText, queryByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Zipro Rave'));
      expect(getByText('Replace')).toBeTruthy();
      fireEvent.press(getByText('Zipro Rave'));
      expect(queryByText('Replace')).toBeNull();
    });

    it('tapping bike tile body does NOT call setPrimary', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockWatchHr, {
        availableSources: ['bike'],
        setPrimary: jest.fn(),
      });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Zipro Rave'));
      expect(mockWatchHr.setPrimary).not.toHaveBeenCalled();
    });

    it('tapping HR strap chevron does NOT call setPrimary', () => {
      Object.assign(mockSavedGear, {
        savedBike: null,
        savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' },
      });
      Object.assign(mockWatchHr, {
        availableSources: ['bluetooth', 'bike'],
        primary: 'bike',
        setPrimary: jest.fn(),
      });
      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId('hr-strap-chevron'));
      expect(mockWatchHr.setPrimary).not.toHaveBeenCalled();
    });

    it('tapping HR strap tile body selects it and does NOT expand management', () => {
      Object.assign(mockSavedGear, {
        savedBike: null,
        savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' },
      });
      Object.assign(mockWatchHr, {
        availableSources: ['bluetooth', 'bike'],
        primary: 'bike',
        setPrimary: jest.fn(),
      });
      const { getAllByText, queryByText } = render(<SettingsScreen />);
      fireEvent.press(getAllByText('HRM-Dual:031993')[0]);
      expect(mockWatchHr.setPrimary).toHaveBeenCalledWith('bluetooth');
      // Management buttons should NOT appear just from selecting
      expect(queryByText('Forget')).toBeNull();
    });

    it('selected HR source tile has accessibilityState selected=true', () => {
      Object.assign(mockWatchHr, {
        availableSources: ['bike'],
        primary: 'bike',
      });
      const { getByTestId } = render(<SettingsScreen />);
      const bikeHrTile = getByTestId('hr-tile-bike');
      expect(bikeHrTile.props.accessibilityState).toMatchObject({ selected: true });
    });

    it('unselected HR source tile has accessibilityState selected=false', () => {
      Object.assign(mockWatchHr, {
        watchAvailable: true,
        availableSources: ['watch', 'bike'],
        primary: 'bike',
      });
      const { getByTestId } = render(<SettingsScreen />);
      const watchTile = getByTestId('hr-tile-watch');
      expect(watchTile.props.accessibilityState).toMatchObject({ selected: false });
    });

    it('no saved bike shows "Not set up" text and Set Up button (no chevron)', () => {
      Object.assign(mockSavedGear, { savedBike: null });
      const { getByText, queryByTestId } = render(<SettingsScreen />);
      expect(getByText('Not set up')).toBeTruthy();
      expect(getByText('Set Up')).toBeTruthy();
      expect(queryByTestId('bike-tile-chevron')).toBeNull();
    });

    it('saved bike shows a chevron (expand toggle) on the tile', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      const { getByTestId } = render(<SettingsScreen />);
      expect(getByTestId('bike-tile-chevron')).toBeTruthy();
    });

    it('Apple Watch HR tile has no chevron', () => {
      Object.assign(mockWatchHr, {
        watchAvailable: true,
        availableSources: ['watch', 'bike'],
      });
      const { queryByTestId } = render(<SettingsScreen />);
      expect(queryByTestId('hr-watch-chevron')).toBeNull();
    });

    it('Bike pulse HR tile has no chevron', () => {
      Object.assign(mockWatchHr, { availableSources: ['bike'] });
      const { queryByTestId } = render(<SettingsScreen />);
      expect(queryByTestId('hr-bike-chevron')).toBeNull();
    });

    it('calls forgetBike when Forget is pressed after expanding bike tile', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Zipro Rave'));
      fireEvent.press(getByText('Forget'));
      expect(mockSavedGear.forgetBike).toHaveBeenCalled();
    });
  });
});
