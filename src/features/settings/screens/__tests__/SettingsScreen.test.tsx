import { render, fireEvent } from '@testing-library/react-native';

import { SettingsScreen } from '../SettingsScreen';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import type { HrSource } from '../../../../services/hr/hrSource';
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
  primary: null as HrSource | null,
  effectivePrimary: 'bike' as HrSource,
  setPrimary: jest.fn(),
  availableSources: ['bike'] as HrSource[],
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
      effectivePrimary: 'bike',
      setPrimary: jest.fn(),
      availableSources: ['bike'] as HrSource[],
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

  it('shows setup CTAs for unsaved gear', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Set Up Smart Bike')).toBeTruthy();
    expect(getByText('Add Bluetooth HR')).toBeTruthy();
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

  it('exposes Replace and Forget for the saved bike (swipe actions, always reachable)', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Replace')).toBeTruthy();
    expect(getByText('Forget')).toBeTruthy();
  });

  it('navigates to gear setup with bike target when Set Up Smart Bike is pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Set Up Smart Bike'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=bike');
  });

  it('navigates to gear setup with hr target when Add Bluetooth HR is pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Add Bluetooth HR'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=hr');
  });

  it('calls forgetBike when Forget is pressed on the saved bike', () => {
    Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
    const { getByText } = render(<SettingsScreen />);
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
    it('shows an inline Connect chip for the bike when saved and not connected', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Connect')).toBeTruthy();
    });

    it('calls retryBike when the bike Connect chip is pressed', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Connect'));
      expect(mockAutoReconnect.retryBike).toHaveBeenCalled();
    });

    it('shows a disabled Connecting... chip for the bike while connecting', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      Object.assign(mockConnection, { bikeConnected: false });
      Object.assign(mockAutoReconnect, { bikeReconnectState: 'connecting' });
      const { getByText, queryByText } = render(<SettingsScreen />);
      expect(getByText('Connecting...')).toBeTruthy();
      expect(queryByText('Connect')).toBeNull();
      expect(mockAutoReconnect.retryBike).not.toHaveBeenCalled();
    });

    it('shows a disabled Connecting... chip for the HR strap while connecting', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      Object.assign(mockAutoReconnect, { hrReconnectState: 'connecting' });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText, queryByText } = render(<SettingsScreen />);
      expect(getByText('Connecting...')).toBeTruthy();
      expect(queryByText('Connect')).toBeNull();
      fireEvent.press(getByText('Connecting...'));
      expect(mockAutoReconnect.retryHr).not.toHaveBeenCalled();
    });

    it('does not show a Connect chip for the bike when connected', () => {
      Object.assign(mockSavedGear, {
        savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' },
        savedHrSource: null,
      });
      Object.assign(mockConnection, { bikeConnected: true, hrConnected: false });
      const { queryByText } = render(<SettingsScreen />);
      expect(queryByText('Connect')).toBeNull();
    });

    it('shows an inline Connect chip for the HR strap when saved and not connected', () => {
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { hrConnected: false });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getAllByText } = render(<SettingsScreen />);
      expect(getAllByText('Connect').length).toBeGreaterThan(0);
    });

    it('calls retryHr when the HR strap Connect chip is pressed', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Connect'));
      expect(mockAutoReconnect.retryHr).toHaveBeenCalled();
    });

    it('does not show a Connect chip for the HR strap when connected', () => {
      Object.assign(mockSavedGear, { savedBike: null, savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' } });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: true });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
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

    it('exposes Replace and Forget for the saved HR strap (swipe actions, always reachable)', () => {
      Object.assign(mockSavedGear, { savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' } });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Replace')).toBeTruthy();
      expect(getByText('Forget')).toBeTruthy();
    });

    it('pressing Forget on the HR strap calls forgetHr and does NOT call setPrimary', () => {
      Object.assign(mockSavedGear, {
        savedBike: null,
        savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' },
      });
      Object.assign(mockWatchHr, {
        availableSources: ['bluetooth', 'bike'],
        primary: 'bluetooth',
        setPrimary: jest.fn(),
      });
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Forget'));
      expect(mockSavedGear.forgetHr).toHaveBeenCalled();
      expect(mockWatchHr.setPrimary).not.toHaveBeenCalled();
    });

    it('shows an inline Connect chip for the HR strap when disconnected; pressing it calls retryHr', () => {
      Object.assign(mockSavedGear, {
        savedBike: null,
        savedHrSource: { id: 'hr-1', name: 'HRM-Dual:031993', type: 'hr' },
      });
      Object.assign(mockConnection, { bikeConnected: false, hrConnected: false });
      Object.assign(mockWatchHr, { availableSources: ['bluetooth', 'bike'] });
      const { getByText } = render(<SettingsScreen />);
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

    it('only the HR strap is swipeable — watch and bike pulse have no management actions', () => {
      Object.assign(mockSavedGear, {
        savedHrSource: { id: 'hr-1', name: 'Polar H10', type: 'hr' },
      });
      Object.assign(mockConnection, { hrConnected: true });
      Object.assign(mockWatchHr, {
        watchAvailable: true,
        availableSources: ['watch', 'bluetooth', 'bike'],
        primary: 'bluetooth',
      });
      const { getAllByText } = render(<SettingsScreen />);
      // Replace/Forget appear exactly once — for the strap only (watch & bike pulse can't be removed)
      expect(getAllByText('Replace')).toHaveLength(1);
      expect(getAllByText('Forget')).toHaveLength(1);
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

    // --- Swipe-model spec (tap-to-select + swipe-to-manage, no expand) ---

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

    it('tapping HR strap tile body selects it (setPrimary bluetooth)', () => {
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
      fireEvent.press(getByTestId('hr-tile-bluetooth'));
      expect(mockWatchHr.setPrimary).toHaveBeenCalledWith('bluetooth');
    });

    it('selected HR source tile has accessibilityState selected=true', () => {
      Object.assign(mockWatchHr, {
        availableSources: ['bike'],
        primary: 'bike',
        effectivePrimary: 'bike',
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
        effectivePrimary: 'bike',
      });
      const { getByTestId } = render(<SettingsScreen />);
      const watchTile = getByTestId('hr-tile-watch');
      expect(watchTile.props.accessibilityState).toMatchObject({ selected: false });
    });

    it('selects the effective-default tile when no explicit primary is set (finding #1)', () => {
      // No explicit choice: the resolved default (Watch, here connected) is shown
      // as selected so the UI never renders "nothing selected".
      Object.assign(mockWatchHr, {
        watchAvailable: true,
        availableSources: ['watch', 'bike'],
        primary: null,
        effectivePrimary: 'watch',
      });
      const { getByTestId } = render(<SettingsScreen />);
      expect(getByTestId('hr-tile-watch').props.accessibilityState).toMatchObject({ selected: true });
      expect(getByTestId('hr-tile-bike').props.accessibilityState).toMatchObject({ selected: false });
    });

    it('bike tile body does NOT have accessibilityState.selected', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      const { getByTestId } = render(<SettingsScreen />);
      const bikeTileBody = getByTestId('bike-tile-header');
      expect(bikeTileBody.props.accessibilityState?.selected).toBeUndefined();
    });

    it('no saved bike shows the Set Up Smart Bike CTA (no chevron)', () => {
      Object.assign(mockSavedGear, { savedBike: null });
      const { getByText, queryByTestId } = render(<SettingsScreen />);
      expect(getByText('Set Up Smart Bike')).toBeTruthy();
      expect(queryByTestId('bike-tile-chevron')).toBeNull();
    });

    it('saved bike is swipeable (Replace/Forget present) and has no chevron', () => {
      Object.assign(mockSavedGear, { savedBike: { id: 'uuid', name: 'Zipro Rave', type: 'bike' } });
      const { getByText, queryByTestId } = render(<SettingsScreen />);
      expect(getByText('Replace')).toBeTruthy();
      expect(getByText('Forget')).toBeTruthy();
      expect(queryByTestId('bike-tile-chevron')).toBeNull();
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
  });
});
