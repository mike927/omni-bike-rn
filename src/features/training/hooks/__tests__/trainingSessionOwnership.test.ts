import { act, renderHook } from '@testing-library/react-native';

import { useTrainingSession } from '../useTrainingSession';
import { useTrainingSessionLifecycle } from '../useTrainingSessionLifecycle';
import { isSessionEngineRunning } from '../../sessionController';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { BikeStatus } from '../../../../services/ble/BikeAdapter';
import { TrainingPhase } from '../../../../types/training';

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
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('should not accumulate while Paused, whichever consumer paused the ride', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const training = await mountSessionConsumer();

    await act(() => {
      home.session.current.start();
    });
    await advanceOneSecond();

    await act(() => {
      training.session.current.pause();
    });

    const paused = useTrainingSessionStore.getState().elapsedSeconds;
    await advanceOneSecond();
    await advanceOneSecond();

    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(paused);

    await act(() => {
      training.session.current.resume();
    });
    await advanceOneSecond();

    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(paused + 1);

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

  it('should let a later ride record after a stale consumer unmounted', async () => {
    const root = await mountRootLifecycle();
    const home = await mountSessionConsumer();
    const stale = await mountSessionConsumer();

    await act(() => {
      stale.session.current.start();
    });
    await act(() => {
      stale.session.current.finish();
    });
    await act(async () => {
      await stale.session.current.reset();
    });

    await stale.unmount();

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
});
