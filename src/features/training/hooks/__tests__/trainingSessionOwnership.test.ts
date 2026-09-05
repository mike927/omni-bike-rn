import { act, renderHook } from '@testing-library/react-native';

import { useTrainingSession } from '../useTrainingSession';
import { useTrainingSessionLifecycle } from '../useTrainingSessionLifecycle';
import * as trainingSessionPersistenceModule from '../useTrainingSessionPersistence';
import { isSessionEngineRunning } from '../../sessionController';
import { buildTrainingSummaryRoute, POST_FINISH_TRAINING_SUMMARY_SOURCE } from '../../navigation/trainingSummaryRoute';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSessionPersistenceStore } from '../../../../store/sessionPersistenceStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { BikeStatus } from '../../../../services/ble/BikeAdapter';
import { TrainingPhase } from '../../../../types/training';

// The wrist remote is part of the root-owned lifecycle, so this suite loads the
// native bridge and the router. Both are stubbed; what is under test is WHO owns
// the listener, not what the bridge does.
type WatchControlListener = (payload: { action: string; sentAtMs?: number }) => void;

jest.mock('watch-connectivity', () => {
  const listeners: Record<string, WatchControlListener> = {};
  return {
    __listeners: listeners,
    isWatchConnectivityAvailable: true,
    WatchConnectivity: {
      addListener: jest.fn((event: string, cb: WatchControlListener) => {
        listeners[event] = cb;
        return {
          remove: jest.fn(() => {
            delete listeners[event];
          }),
        };
      }),
    },
  };
});

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));

function watchConnectivityMock() {
  return jest.requireMock('watch-connectivity') as {
    __listeners: Record<string, WatchControlListener>;
    WatchConnectivity: { addListener: jest.Mock };
  };
}

function routerMock() {
  return (jest.requireMock('expo-router') as { router: { replace: jest.Mock } }).router;
}

/** Tap Pause / Resume / End on the wrist. */
async function tapOnWrist(action: 'pause' | 'resume' | 'end'): Promise<void> {
  const listener = watchConnectivityMock().__listeners.onWatchControlRequest;
  expect(listener).toBeDefined();
  await act(async () => {
    listener?.({ action });
  });
}

/**
 * Ownership regression suite for the training session lifecycle (audit A01).
 *
 * Deliberately uses the REAL MetronomeEngine so the assertions are about how
 * many 1 Hz clocks exist, not about how often a mock was called. The root
 * lifecycle, Home and the Training dashboard are rendered as independent trees,
 * which is what React Navigation does when Training is pushed on top of Home.
 */

const mockSetControlState = jest.fn();

function seedConnectedBike(): void {
  useDeviceConnectionStore.getState().setBikeAdapter({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeToMetrics: jest.fn(),
    setControlState: mockSetControlState,
  });
  useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 0, cadence: 0, power: 0 });
}

/** Mount the single root-owned lifecycle: the app does this in `useAppInitialization`. */
async function mountRootLifecycle() {
  const view = await renderHook(() => useTrainingSessionLifecycle());
  return { unmount: view.unmount };
}

/** Mount one screen consumer (Home or the Training dashboard). */
async function mountSessionConsumer() {
  const view = await renderHook(() => useTrainingSession());
  return { session: view.result, unmount: view.unmount };
}

/**
 * Advance one simulated second and refresh the bike heartbeat, so the
 * stale-telemetry watchdog does not freeze the ride mid-assertion.
 */
async function advanceOneSecond(): Promise<void> {
  await act(() => {
    jest.advanceTimersByTime(1000);
  });
  await act(() => {
    useDeviceConnectionStore.getState().updateBikeMetrics({ speed: 0, cadence: 0, power: 0 });
  });
}

describe('training session engine ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T08:00:00.000Z'));
    mockSetControlState.mockResolvedValue(undefined);
    useDeviceConnectionStore.getState().clearAll();
    useTrainingSessionStore.getState().reset();
    useSessionPersistenceStore.getState().clear();
    useSavedGearStore.setState({
      savedBike: { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: null,
      hydrated: true,
      bikeReconnectState: 'connected',
      hrReconnectState: 'disconnected',
      bikeAutoReconnectSuppressed: false,
      hrAutoReconnectSuppressed: false,
    });
    seedConnectedBike();
    // The wrist bridge logs every request through `logWc`; keep the suite output readable.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    for (const event of Object.keys(watchConnectivityMock().__listeners)) {
      delete watchConnectivityMock().__listeners[event];
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should advance exactly one second per second while Home and Training are both mounted', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    await act(() => {
      home.session.current.start();
    });

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);

    await advanceOneSecond();
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(1);

    await advanceOneSecond();
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(2);

    await training.unmount();
    await home.unmount();
    await root.unmount();
  });

  it('should keep exactly one clock after a bike-started ride is paused and resumed from Training', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    await act(() => {
      useDeviceConnectionStore.getState().updateBikeMetrics({
        speed: 25,
        cadence: 80,
        power: 150,
        status: BikeStatus.Started,
      });
    });

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);

    await act(() => {
      training.session.current.pause();
    });
    await act(() => {
      training.session.current.resume();
    });

    const before = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();

    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(before + 1);

    await training.unmount();
    await home.unmount();
    await root.unmount();
  });

  it('should stop the clock while Paused, whichever consumer paused, across repeated cycles', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    await act(() => {
      home.session.current.start();
    });
    await advanceOneSecond();
    expect(isSessionEngineRunning()).toBe(true);

    // Two full cycles, both issued from the consumer that did NOT start the ride.
    let baseline = useTrainingSessionStore.getState().elapsedSeconds;

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await act(() => {
        training.session.current.pause();
      });

      // The clock must actually be stopped. Asserting elapsedSeconds alone would
      // pass on a still-running timer, because the store discards ticks unless the
      // phase is Active; this is the assertion that makes "zero while Paused" bind.
      expect(isSessionEngineRunning()).toBe(false);

      await advanceOneSecond();
      await advanceOneSecond();
      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(baseline);

      await act(() => {
        training.session.current.resume();
      });
      expect(isSessionEngineRunning()).toBe(true);

      await advanceOneSecond();
      expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(baseline + 1);
      baseline += 1;
    }

    await training.unmount();
    await home.unmount();
    await root.unmount();
  });

  it('should keep recording when Training is closed with Back and reopened', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    await act(() => {
      training.session.current.start();
    });

    // Back: React Navigation unmounts the pushed screen, Home stays mounted.
    await training.unmount();

    const afterBack = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(afterBack + 1);

    // Reopen Training.
    const reopened = await mountSessionConsumer();

    const afterReopen = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(afterReopen + 1);

    await reopened.unmount();
    await home.unmount();
    await root.unmount();
  });

  it('should leave no running clock after finish and after reset', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();

    await act(() => {
      home.session.current.start();
    });
    await advanceOneSecond();

    await act(() => {
      home.session.current.finish();
    });

    // Finish must stop the clock itself, not just make the store ignore its ticks.
    expect(isSessionEngineRunning()).toBe(false);

    const finished = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();
    await advanceOneSecond();
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(finished);

    await act(async () => {
      await home.session.current.reset();
    });

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    expect(isSessionEngineRunning()).toBe(false);

    await home.unmount();
    await root.unmount();
  });

  it('should let a later ride record after a stale consumer unmounted mid-ride', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const stale = await mountSessionConsumer();

    // The consumer that starts the ride goes away while the ride is still running,
    // so its teardown is the "stale cleanup" the acceptance criterion is about.
    await act(() => {
      stale.session.current.start();
    });
    await advanceOneSecond();
    await stale.unmount();

    expect(isSessionEngineRunning()).toBe(true);
    const afterStaleUnmount = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(afterStaleUnmount + 1);

    // End that ride from the surviving consumer, then start a later one.
    await act(() => {
      home.session.current.finish();
    });
    await act(async () => {
      await home.session.current.reset();
    });
    expect(isSessionEngineRunning()).toBe(false);

    await act(() => {
      seedConnectedBike();
    });

    await act(() => {
      home.session.current.start();
    });

    const started = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();

    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(started + 1);

    await home.unmount();
    await root.unmount();
  });

  it('should subscribe the wrist remote from the root alone, with no screen mounted', async () => {
    const root = await mountRootLifecycle();

    // Fails if the Watch listener goes back to being screen-owned: no screen is
    // mounted here, and the ride must still be controllable from the wrist.
    expect(watchConnectivityMock().WatchConnectivity.addListener).toHaveBeenCalledTimes(1);
    expect(watchConnectivityMock().WatchConnectivity.addListener).toHaveBeenCalledWith(
      'onWatchControlRequest',
      expect.any(Function),
    );

    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    // Consumers add nothing: still exactly one listener for the whole app.
    expect(watchConnectivityMock().WatchConnectivity.addListener).toHaveBeenCalledTimes(1);

    await training.unmount();
    await home.unmount();
    await root.unmount();
  });

  it('should still accept on-wrist Pause and Resume after Training is closed with Back', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    await act(() => {
      training.session.current.start();
    });

    // Back: the screen that showed the ride controls is gone, the ride is not.
    await training.unmount();

    await tapOnWrist('pause');
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);
    expect(isSessionEngineRunning()).toBe(false);

    await tapOnWrist('resume');
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
    expect(isSessionEngineRunning()).toBe(true);

    const resumed = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(resumed + 1);

    await home.unmount();
    await root.unmount();
  });

  // Audit A06: manual pause is the higher authority. The Watch remote pauses
  // through the same `pauseSession` command a screen uses, so it must follow
  // the same precedence: a bike Started event must not override it.
  it('should keep a ride Paused after an on-wrist Pause even when the bike reports Started', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();

    await act(() => {
      home.session.current.start();
    });

    await tapOnWrist('pause');
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);
    expect(isSessionEngineRunning()).toBe(false);

    await act(() => {
      useDeviceConnectionStore.getState().updateBikeMetrics({
        speed: 25,
        cadence: 80,
        power: 150,
        status: BikeStatus.Started,
      });
    });

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);
    expect(isSessionEngineRunning()).toBe(false);

    await tapOnWrist('resume');
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
    expect(isSessionEngineRunning()).toBe(true);

    await home.unmount();
    await root.unmount();
  });

  it('should end the ride and open its summary when End is tapped on the wrist after Back', async () => {
    jest.spyOn(trainingSessionPersistenceModule, 'getActiveSessionId').mockReturnValue('session-42');

    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    await act(() => {
      training.session.current.start();
    });
    await advanceOneSecond();
    await training.unmount();

    await tapOnWrist('end');

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    expect(isSessionEngineRunning()).toBe(false);
    expect(routerMock().replace).toHaveBeenCalledWith(
      buildTrainingSummaryRoute('session-42', POST_FINISH_TRAINING_SUMMARY_SOURCE, '/'),
    );

    await home.unmount();
    await root.unmount();
  });

  // Audit A02: the wrist can end a ride the user is not looking at, so a failed
  // save has to reach them on the screen that owns the recovery choice.
  it('should send the user to the ride screen when an on-wrist End cannot be saved', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();

    await act(() => {
      home.session.current.start();
    });
    await advanceOneSecond();

    // The ride's write failed: this is what the persistence subscriber reports.
    await act(() => {
      useSessionPersistenceStore.setState({
        status: 'unsaved',
        sessionId: 'session-51',
        lastErrorMessage: 'disk full',
      });
    });

    await tapOnWrist('end');

    // Kept, not torn down, and never routed to a summary that does not exist.
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Finished);
    expect(useDeviceConnectionStore.getState().bikeAdapter).not.toBeNull();
    expect(routerMock().replace).toHaveBeenCalledWith('/training');

    await home.unmount();
    await root.unmount();
  });

  it('should ignore a stray on-wrist End when no ride is running', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();

    await tapOnWrist('end');

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    expect(routerMock().replace).not.toHaveBeenCalled();

    await home.unmount();
    await root.unmount();
  });
});
