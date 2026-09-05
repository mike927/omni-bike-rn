import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAutoReconnect } from '../useAutoReconnect';
import { useAutoReconnectLifecycle } from '../useAutoReconnectLifecycle';
import { releaseReconnectSchedules } from '../../reconnectController';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

/**
 * Ownership regression suite for the auto-reconnect policy (audit A10).
 *
 * Reconnect policy is global, like the ride: the retry budget, the probe
 * cadence and the timers belong to one owner mounted from app boot, and screens
 * only read the resulting state and press Retry. These tests therefore render
 * the owner once and the screens as independent trees, which is what React
 * Navigation does when Training or Settings is pushed on top of Home.
 *
 * What they pin: one budget however many screens are mounted, a cycle that
 * neither stops nor restarts when a screen comes or goes, and bike and strap
 * budgets that stay independent of one another.
 */

const mockConnectBike = jest.fn();
const mockConnectHr = jest.fn();
const mockDisconnectBike = jest.fn();
const mockDisconnectHr = jest.fn();

jest.mock('../../../../services/gear/gearStorage');
// Only the module-scope connect operations. Nothing rendered here instantiates
// the `useDeviceConnection` hook: the owner and the consumer both reach the
// transport through these four functions.
jest.mock('../../../training/hooks/useDeviceConnection', () => ({
  connectBikeDevice: (...args: unknown[]) => mockConnectBike(...args),
  connectHrDevice: (...args: unknown[]) => mockConnectHr(...args),
  disconnectBikeDevice: () => mockDisconnectBike(),
  disconnectHrDevice: () => mockDisconnectHr(),
}));

const bike = { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' as const };
const hr = { id: 'hr-uuid', name: 'Garmin HRM', type: 'hr' as const };

const appStateListeners: ((next: AppStateStatus) => void)[] = [];

function emitAppStateChange(next: AppStateStatus): void {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: next });
  for (const listener of [...appStateListeners]) {
    listener(next);
  }
}

/** Mount the single app-boot owner of reconnect policy: `useAppInitialization` does this. */
async function mountReconnectOwner() {
  const view = await renderHook(() => useAutoReconnectLifecycle());
  return { unmount: view.unmount };
}

/** Mount one screen consumer (Home, Training or Settings). */
async function mountReconnectConsumer() {
  const view = await renderHook(() => useAutoReconnect());
  return { reconnect: view.result, unmount: view.unmount };
}

/** Let the probe that just fired settle its rejection. */
async function settleProbe(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.useFakeTimers();
  // The policy is a module singleton, so each test starts from a stood-down
  // owner: a probe left in flight by the previous test must not spend this
  // one's budget.
  releaseReconnectSchedules();
  appStateListeners.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((eventType, listener) => {
    if (eventType !== 'change') {
      return { remove: () => {} } as never;
    }
    const typedListener = listener as (next: AppStateStatus) => void;
    appStateListeners.push(typedListener);
    return {
      remove: () => {
        const index = appStateListeners.indexOf(typedListener);
        if (index >= 0) {
          appStateListeners.splice(index, 1);
        }
      },
    };
  });
  emitAppStateChange('active');
  useDeviceConnectionStore.setState({
    bikeAdapter: null,
    hrAdapter: null,
    bikeConnectionInProgress: false,
    hrConnectionInProgress: false,
  });
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: null,
    hydrated: false,
    bikeReconnectState: 'idle',
    hrReconnectState: 'idle',
    bikeAutoReconnectSuppressed: false,
    hrAutoReconnectSuppressed: false,
  });
  mockConnectBike.mockRejectedValue(new Error('Operation timed out'));
  mockConnectHr.mockRejectedValue(new Error('Operation timed out'));
  mockDisconnectBike.mockResolvedValue(undefined);
  mockDisconnectHr.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('auto-reconnect ownership', () => {
  it('spends one retry budget however many screens are mounted', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await mountReconnectOwner();
    await mountReconnectConsumer();
    await mountReconnectConsumer();
    await mountReconnectConsumer();

    // Probe 1, immediately.
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    // Probe 2, at +3s.
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(2);

    // Probe 3, at +5s.
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(3);

    // Budget spent, whoever is watching.
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(3);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
  });

  it('keeps the cycle on cadence when a screen unmounts mid-cycle', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await mountReconnectOwner();
    const home = await mountReconnectConsumer();
    await mountReconnectConsumer();

    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    // Navigating away is not a reason to abandon or restart the cycle.
    await home.unmount();

    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
  });

  it('keeps the cycle running after the last screen unmounts', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await mountReconnectOwner();
    const home = await mountReconnectConsumer();

    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await home.unmount();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
  });

  it('does not re-arm the cycle from a probe that settles after the owner is gone', async () => {
    let rejectProbe!: (err: Error) => void;
    mockConnectBike.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectProbe = reject;
        }),
    );
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    const owner = await mountReconnectOwner();
    await mountReconnectConsumer();

    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    // The app tree goes away while probe 1 is still in flight.
    await owner.unmount();

    await act(async () => {
      rejectProbe(new Error('Operation timed out'));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Nothing is left to reconcile the policy, so nothing may arm a timer.
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(1);
  });

  it('neither dials nor restarts the wait when a screen mounts mid-cycle', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await mountReconnectOwner();
    await mountReconnectConsumer();

    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Pushing Training on top of Home mid-cycle.
    await mountReconnectConsumer();
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    // The wait still ends 3s after probe 1, not 3s after the new screen appeared.
    await act(async () => {
      jest.advanceTimersByTime(999);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
  });

  it('gives the bike and the strap independent budgets', async () => {
    useSavedGearStore.setState({ savedBike: bike, savedHrSource: hr, hydrated: true });

    await mountReconnectOwner();
    await mountReconnectConsumer();

    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    expect(mockConnectHr).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
    expect(mockConnectHr).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(3);
    expect(mockConnectHr).toHaveBeenCalledTimes(3);

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockConnectBike).toHaveBeenCalledTimes(3);
    expect(mockConnectHr).toHaveBeenCalledTimes(3);
  });

  it('leaves the strap alone when the bike budget is spent', async () => {
    mockConnectHr.mockImplementation(() => {
      useDeviceConnectionStore.setState({ hrAdapter: {} as never });
      return Promise.resolve();
    });
    useSavedGearStore.setState({ savedBike: bike, savedHrSource: hr, hydrated: true });

    await mountReconnectOwner();
    await mountReconnectConsumer();

    await settleProbe();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await settleProbe();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await settleProbe();
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(3);
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
    // The strap connected once and was never dialled again by the bike's cycle.
    expect(mockConnectHr).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().hrReconnectState).toBe('connected');
  });

  it('dials once when Retry is pressed on one screen while others are mounted', async () => {
    useSavedGearStore.setState({
      savedBike: bike,
      hydrated: true,
      bikeReconnectState: 'failed',
      bikeAutoReconnectSuppressed: true,
    });

    await mountReconnectOwner();
    await mountReconnectConsumer();
    const settings = await mountReconnectConsumer();

    expect(mockConnectBike).not.toHaveBeenCalled();

    await act(() => {
      settings.reconnect.current.retryBike();
    });

    expect(mockConnectBike).toHaveBeenCalledTimes(1);
    expect(useSavedGearStore.getState().bikeAutoReconnectSuppressed).toBe(false);
  });

  // Every screen reads the owner's cycle, not its own: the states below are the
  // ones the controller writes as the cycle runs, so this fails if the policy
  // stops publishing them or the consumer stops reading them live.
  it('shows every mounted screen the same states as the owner cycle runs', async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await mountReconnectOwner();
    const home = await mountReconnectConsumer();
    const training = await mountReconnectConsumer();

    // Probe 1 failed transiently: both screens read one continuous "Connecting…".
    await settleProbe();
    expect(home.reconnect.current.bikeReconnectState).toBe('connecting');
    expect(training.reconnect.current.bikeReconnectState).toBe('connecting');

    // Spend the rest of the budget: both screens land on the terminal state.
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await settleProbe();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await settleProbe();

    expect(home.reconnect.current.bikeReconnectState).toBe('disconnected');
    expect(training.reconnect.current.bikeReconnectState).toBe('disconnected');
  });

  // The owner reconciles one role per effect. A shared effect would clear and
  // re-arm the other role's pending wait every time this one moved, which is a
  // probe silently slipping later, so both directions are pinned.
  it("does not delay the strap's next probe when a bike change reconciles", async () => {
    useSavedGearStore.setState({ savedHrSource: hr, hydrated: true });

    await mountReconnectOwner();
    await mountReconnectConsumer();

    // Probe 1 failed, so the strap is waiting out its 3 s.
    await settleProbe();
    expect(mockConnectHr).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // A bike-only store change, 2 s into the strap's wait.
    await act(() => {
      useDeviceConnectionStore.setState({ bikeAdapter: {} as never });
    });

    // The strap's probe 2 still lands 3 s after its probe 1, not 3 s after the
    // bike moved.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await settleProbe();
    expect(mockConnectHr).toHaveBeenCalledTimes(2);
  });

  it("does not delay the bike's next probe when a strap change reconciles", async () => {
    useSavedGearStore.setState({ savedBike: bike, hydrated: true });

    await mountReconnectOwner();
    await mountReconnectConsumer();

    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await act(() => {
      useDeviceConnectionStore.setState({ hrAdapter: {} as never });
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await settleProbe();
    expect(mockConnectBike).toHaveBeenCalledTimes(2);
  });
});
