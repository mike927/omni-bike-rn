import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { SavedDevice } from '../../../../types/gear';
import { buildTrainingSummaryRoute, POST_FINISH_TRAINING_SUMMARY_SOURCE } from '../../navigation/trainingSummaryRoute';
import { TrainingDashboardScreen } from '../TrainingDashboardScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();

const mockSession = {
  phase: 'idle',
  elapsedSeconds: 0,
  totalDistance: 0,
  totalCalories: 0,
  currentMetrics: {
    speed: 0,
    cadence: 0,
    power: 0,
    heartRate: null,
    resistance: null,
    distance: null,
  },
  start: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  finish: jest.fn(),
  finishAndDisconnect: jest.fn().mockResolvedValue('session-1'),
  reset: jest.fn(),
};

const mockDeviceConnection = {
  bikeConnected: false,
  hrConnected: false,
  latestBikeMetrics: null as null | { heartRate?: number },
  latestBluetoothHr: null,
  latestAppleWatchHr: null,
  lastAppleWatchSampleAtMs: null,
  watchAvailability: 'unavailable',
};

// Mutable store state for deviceConnectionStore fields not exposed by useDeviceConnection
const mockDeviceConnectionStoreState = {
  activeHrSource: null as string | null,
  lastBluetoothHrSampleAtMs: null as number | null,
  watchAvailability: 'unavailable' as string,
};

const mockHrSourceStoreState = {
  primary: null as string | null,
};

const mockSavedGear: {
  savedBike: SavedDevice | null;
  savedHrSource: SavedDevice | null;
} = {
  savedBike: null,
  savedHrSource: null,
};

const mockAutoReconnect = {
  bikeReconnectState: 'idle' as const,
  hrReconnectState: 'idle' as const,
  retryBike: jest.fn(),
  retryHr: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../hooks/useTrainingSession', () => ({
  useTrainingSession: () => mockSession,
}));

// The wrist-remote bridge subscribes to the native WatchConnectivity module; stub it so
// the screen test doesn't pull the native bridge. Its behavior is unit-tested separately.
jest.mock('../../hooks/useWatchRemoteControl', () => ({
  useWatchRemoteControl: jest.fn(),
}));

jest.mock('../../hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => mockDeviceConnection,
}));

jest.mock('../../../gear/hooks/useSavedGear', () => ({
  useSavedGear: () => mockSavedGear,
}));

jest.mock('../../../gear/hooks/useAutoReconnect', () => ({
  useAutoReconnect: () => mockAutoReconnect,
}));

jest.mock('../../../../store/deviceConnectionStore', () => ({
  useDeviceConnectionStore: (selector: (s: typeof mockDeviceConnectionStoreState) => unknown) =>
    selector(mockDeviceConnectionStoreState),
}));

jest.mock('../../../../store/hrSourceStore', () => ({
  useHrSourceStore: (selector: (s: typeof mockHrSourceStoreState) => unknown) => selector(mockHrSourceStoreState),
}));

describe('TrainingDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockSession, {
      phase: 'idle',
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      currentMetrics: {
        speed: 0,
        cadence: 0,
        power: 0,
        heartRate: null,
        resistance: null,
        distance: null,
      },
      finishAndDisconnect: jest.fn().mockResolvedValue('session-1'),
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: false,
      hrConnected: false,
      latestBikeMetrics: null,
      latestBluetoothHr: null,
      latestAppleWatchHr: null,
      lastAppleWatchSampleAtMs: null,
      watchAvailability: 'unavailable',
    });
    mockSavedGear.savedBike = null;
    mockSavedGear.savedHrSource = null;
    Object.assign(mockAutoReconnect, {
      bikeReconnectState: 'idle',
      hrReconnectState: 'idle',
    });
    Object.assign(mockDeviceConnectionStoreState, {
      activeHrSource: null,
      lastBluetoothHrSampleAtMs: null,
      watchAvailability: 'unavailable',
    });
    Object.assign(mockHrSourceStoreState, {
      primary: null,
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<TrainingDashboardScreen />)).not.toThrow();
  });

  describe('Smart Bike status pill', () => {
    it('reads "Not set up" when no bike is saved (finding #4)', () => {
      mockSavedGear.savedBike = null;
      Object.assign(mockDeviceConnection, { bikeConnected: false });

      const { getByLabelText } = render(<TrainingDashboardScreen />);

      expect(getByLabelText('No bike yet: Not set up')).toBeTruthy();
    });

    it('reads "Unavailable" when a bike is saved but not connected', () => {
      mockSavedGear.savedBike = { id: 'bike-1', name: 'Zipro Rave', type: 'bike' };
      Object.assign(mockDeviceConnection, { bikeConnected: false });

      const { getByLabelText } = render(<TrainingDashboardScreen />);

      expect(getByLabelText('Zipro Rave: Unavailable')).toBeTruthy();
    });
  });

  it('shows disconnected-bike recovery actions before a workout starts', () => {
    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Smart Bike connection required')).toBeTruthy();

    fireEvent.press(getByText('Start Ride'));
    expect(mockSession.start).not.toHaveBeenCalled();

    fireEvent.press(getByText('Set Up Smart Bike'));
    expect(mockPush).toHaveBeenCalledWith('/gear-setup?target=bike');

    fireEvent.press(getByText('Back Home'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('starts the workout once the bike is connected', () => {
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText } = render(<TrainingDashboardScreen />);
    fireEvent.press(getByText('Start Ride'));

    expect(mockSession.start).toHaveBeenCalledTimes(1);
  });

  it('shows Pause and Finish while active', () => {
    Object.assign(mockSession, {
      phase: 'active',
      elapsedSeconds: 321,
      totalCalories: 45.6,
      totalDistance: 1234,
      currentMetrics: {
        speed: 31.2,
        cadence: 92,
        power: 248,
        heartRate: 151,
        resistance: 7,
        distance: 1234,
      },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      hrConnected: true,
      latestBluetoothHr: 144,
    });
    Object.assign(mockDeviceConnectionStoreState, {
      activeHrSource: 'bluetooth',
    });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Pause')).toBeTruthy();
    expect(getByText('Finish')).toBeTruthy();
    // Calories shown as a rounded whole-number chip (value + unit are separate nodes).
    expect(getByText('46')).toBeTruthy();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('View Summary')).toBeNull();
  });

  it('renders a Calories tile that tracks the session total', () => {
    Object.assign(mockSession, {
      phase: 'active',
      totalCalories: 123.4,
      currentMetrics: {
        speed: 28,
        cadence: 85,
        power: 210,
        heartRate: 140,
        resistance: 6,
        distance: 1000,
      },
    });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('CAL')).toBeTruthy();
    expect(getByText('123')).toBeTruthy();
  });

  it('shows Resume and Finish while paused', () => {
    Object.assign(mockSession, { phase: 'paused' });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Resume')).toBeTruthy();
    expect(getByText('Finish')).toBeTruthy();
    expect(queryByText('Pause')).toBeNull();
  });

  it('shows reconnection guidance when a paused session has no bike connection', () => {
    Object.assign(mockSession, { phase: 'paused' });
    Object.assign(mockDeviceConnection, { bikeConnected: false });

    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('Smart Bike connection required')).toBeTruthy();
    expect(
      getByText('Reconnect your saved Smart Bike or choose one in setup before you resume this interrupted workout.'),
    ).toBeTruthy();
  });

  it('does not show a summary action once the session is already finished', () => {
    Object.assign(mockSession, { phase: 'finished' });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    expect(queryByText('Pause')).toBeNull();
    expect(queryByText('Resume')).toBeNull();
    expect(queryByText('Finish')).toBeNull();
    expect(queryByText('View Summary')).toBeNull();
    // Finished must NOT fall through to a Start Ride button mid-finish (review #1).
    expect(queryByText('Start Ride')).toBeNull();
    expect(getByText('Finishing...')).toBeTruthy();
  });

  it('finishes, disconnects, and routes directly to summary', async () => {
    let resolveFinish: ((value: string | null) => void) | undefined;
    Object.assign(mockSession, {
      phase: 'active',
      finishAndDisconnect: jest.fn().mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            resolveFinish = resolve;
          }),
      ),
    });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText, queryByText } = render(<TrainingDashboardScreen />);

    fireEvent.press(getByText('Finish'));

    expect(getByText('Finishing...')).toBeTruthy();
    expect(queryByText('Finish')).toBeNull();

    resolveFinish?.('session-77');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        buildTrainingSummaryRoute('session-77', POST_FINISH_TRAINING_SUMMARY_SOURCE, '/'),
      );
    });
  });

  it('shows the session HR from the engine as the big Heart Rate metric', () => {
    Object.assign(mockSession, {
      phase: 'active',
      currentMetrics: {
        speed: 29.4,
        cadence: 86,
        power: 211,
        heartRate: 151,
        resistance: 5,
        distance: 950,
      },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      hrConnected: true,
      latestBluetoothHr: 142,
    });
    Object.assign(mockDeviceConnectionStoreState, {
      activeHrSource: 'bluetooth',
    });

    const { getByText } = render(<TrainingDashboardScreen />);

    // Engine HR wins; raw latestBluetoothHr is not surfaced separately.
    // Value + unit are separate nodes in the hero card.
    expect(getByText('151')).toBeTruthy();
  });

  it('shows -- for Heart Rate when session HR is null (engine has no value)', () => {
    Object.assign(mockSession, {
      phase: 'active',
      currentMetrics: {
        speed: 29.4,
        cadence: 86,
        power: 211,
        heartRate: null,
        resistance: 5,
        distance: 950,
      },
    });
    Object.assign(mockDeviceConnection, { bikeConnected: true });

    const { getByText } = render(<TrainingDashboardScreen />);

    expect(getByText('--')).toBeTruthy();
  });

  // HR tile read-only tests

  it('shows "Apple Watch · Ready" when watch is locked as activeHrSource and sample is fresh', () => {
    Object.assign(mockSession, {
      phase: 'active',
      currentMetrics: {
        speed: 30,
        cadence: 90,
        power: 220,
        heartRate: 150,
        resistance: 6,
        distance: 1100,
      },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: Date.now(),
      watchAvailability: 'connected',
    });
    Object.assign(mockDeviceConnectionStoreState, { activeHrSource: 'watch' });

    const { getByLabelText } = render(<TrainingDashboardScreen />);

    // Status is rendered as a StatusPill in the connection footer (never as "Name · Status" text).
    expect(getByLabelText('Apple Watch: Ready')).toBeTruthy();
  });

  it('shows "Apple Watch · No signal" when watch is locked but sample is stale', () => {
    Object.assign(mockSession, {
      phase: 'active',
      currentMetrics: {
        speed: 30,
        cadence: 90,
        power: 220,
        heartRate: null,
        resistance: 6,
        distance: 1100,
      },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      latestAppleWatchHr: 150,
      lastAppleWatchSampleAtMs: Date.now() - 20_000, // stale > 15s timeout
      watchAvailability: 'connected',
    });
    Object.assign(mockDeviceConnectionStoreState, { activeHrSource: 'watch' });

    const { getByLabelText } = render(<TrainingDashboardScreen />);

    expect(getByLabelText('Apple Watch: No signal')).toBeTruthy();
  });

  it('shows "Polar H10 · Ready" when BLE is locked as activeHrSource', () => {
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      hrConnected: true,
      latestBluetoothHr: 142,
      lastBluetoothHrSampleAtMs: Date.now(),
    });
    Object.assign(mockDeviceConnectionStoreState, {
      activeHrSource: 'bluetooth',
      lastBluetoothHrSampleAtMs: Date.now(),
    });
    mockSavedGear.savedHrSource = { id: 'x', name: 'Polar H10', type: 'hr' };

    const { getByLabelText } = render(<TrainingDashboardScreen />);

    expect(getByLabelText('Polar H10: Ready')).toBeTruthy();
  });

  it('shows "Heart rate · Not set up" in idle when no HR source is available (no watch, no strap)', () => {
    // No primary, watch unavailable, no saved strap → no HR source to show; the
    // bike connection is irrelevant to HR readiness now.
    Object.assign(mockDeviceConnection, { bikeConnected: true });
    const { getByLabelText } = render(<TrainingDashboardScreen />);

    expect(getByLabelText('Heart rate: Not set up')).toBeTruthy();
  });

  it('does not show Watch when bluetooth is locked mid-ride (locked source wins)', () => {
    Object.assign(mockSession, {
      phase: 'active',
      currentMetrics: {
        speed: 30,
        cadence: 90,
        power: 220,
        heartRate: 142,
        resistance: 6,
        distance: 1100,
      },
    });
    Object.assign(mockDeviceConnection, {
      bikeConnected: true,
      hrConnected: true,
      latestBluetoothHr: 142,
      lastAppleWatchSampleAtMs: Date.now(), // fresh watch, but BLE is locked
      latestAppleWatchHr: 150,
      watchAvailability: 'connected',
    });
    Object.assign(mockDeviceConnectionStoreState, {
      activeHrSource: 'bluetooth',
      lastBluetoothHrSampleAtMs: Date.now(),
    });
    mockSavedGear.savedHrSource = { id: 'y', name: 'Polar H10', type: 'hr' };

    const { getByLabelText, queryByText } = render(<TrainingDashboardScreen />);

    expect(getByLabelText('Polar H10: Ready')).toBeTruthy();
    expect(queryByText(/Apple Watch/)).toBeNull();
  });
});
