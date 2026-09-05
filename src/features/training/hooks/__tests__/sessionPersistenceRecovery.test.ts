import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useTrainingSessionPersistence } from '../useTrainingSessionPersistence';
import {
  discardUnsavedSession,
  finishSessionAndDisconnect,
  retryFinishSave,
  startSession,
  type FinishSessionOutcome,
} from '../../sessionController';
import { useSessionPersistenceStore } from '../../../../store/sessionPersistenceStore';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { TrainingPhase, type MetricSnapshot, type TrainingTickInput } from '../../../../types/training';
import * as trainingSessionRepository from '../../../../services/db/trainingSessionRepository';

jest.mock('../../../../services/db/trainingSessionRepository', () => ({
  appendSample: jest.fn(),
  createDraftSession: jest.fn(),
  discardDraftSession: jest.fn(),
  finalizeSession: jest.fn(),
  getLatestOpenSession: jest.fn(),
  updateSessionStatus: jest.fn(),
}));

/**
 * Regression suite for audit A02: a completed ride must never be lost to a
 * silent write failure.
 *
 * The durable outcome is part of the session lifecycle, so these tests drive the
 * real `sessionController` commands with the real persistence subscriber mounted
 * and only the SQLite repository faked. What they assert is the contract between
 * the two: what is written, what the ride's persistence state says while it is
 * wrong, and what Finish is allowed to do when the write failed.
 */

const metrics: MetricSnapshot = {
  speed: 25,
  cadence: 80,
  power: 180,
  heartRate: 145,
  resistance: 7,
  distance: 525,
};

const tickInput: TrainingTickInput = {
  metrics,
  bikeTotalEnergyKcal: null,
  watchActiveKcal: null,
  hasLiveExternalHr: true,
  keytelInputs: null,
};

const mockCreateDraftSession = trainingSessionRepository.createDraftSession as jest.MockedFunction<
  typeof trainingSessionRepository.createDraftSession
>;
const mockAppendSample = trainingSessionRepository.appendSample as jest.MockedFunction<
  typeof trainingSessionRepository.appendSample
>;
const mockFinalizeSession = trainingSessionRepository.finalizeSession as jest.MockedFunction<
  typeof trainingSessionRepository.finalizeSession
>;
const mockDiscardDraftSession = trainingSessionRepository.discardDraftSession as jest.MockedFunction<
  typeof trainingSessionRepository.discardDraftSession
>;

const mockDisconnect = jest.fn().mockResolvedValue(undefined);

function seedConnectedBike(): void {
  useDeviceConnectionStore.getState().setBikeAdapter({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: mockDisconnect,
    subscribeToMetrics: jest.fn(),
    setControlState: jest.fn().mockResolvedValue(undefined),
  });
}

async function mountPersistence() {
  return renderHook(() => useTrainingSessionPersistence());
}

async function rideOneSecond(): Promise<void> {
  await act(() => {
    useTrainingSessionStore.getState().tick(tickInput);
  });
}

/** Session id of the first draft write, which is the ride's stable identity. */
function firstDraftSessionId(): string {
  const sessionId = mockCreateDraftSession.mock.calls[0]?.[0].sessionId;
  expect(sessionId).toBeDefined();
  return sessionId as string;
}

describe('training session persistence failure recovery (A02)', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: these tests install throwing repository
    // implementations, and one test's injected disk failure must not leak into
    // the next one.
    jest.resetAllMocks();
    mockDisconnect.mockResolvedValue(undefined);
    useDeviceConnectionStore.getState().clearAll();
    useTrainingSessionStore.getState().reset();
    useSessionPersistenceStore.getState().clear();
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      hydrated: true,
      bikeReconnectState: 'connected',
      hrReconnectState: 'connected',
      bikeAutoReconnectSuppressed: false,
      hrAutoReconnectSuppressed: false,
    });
    seedConnectedBike();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves a finished ride whose draft write failed at the start', async () => {
    mockCreateDraftSession.mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    await mountPersistence();

    await act(() => {
      startSession();
    });
    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });
    await rideOneSecond();

    let outcome: FinishSessionOutcome | undefined;
    await act(async () => {
      outcome = await finishSessionAndDisconnect();
    });

    // The ride keeps its identity and is written under it at Finish, so the
    // failed draft costs the per-second samples, never the ride.
    const sessionId = firstDraftSessionId();
    expect(mockCreateDraftSession).toHaveBeenCalledTimes(2);
    expect(mockCreateDraftSession.mock.calls[1]?.[0].sessionId).toBe(sessionId);
    expect(mockFinalizeSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId, elapsedSeconds: 1 }));
    expect(outcome).toEqual({ status: 'completed', sessionId });
  });

  it('reports the ride as at risk while it runs without a durable draft', async () => {
    mockCreateDraftSession.mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    await mountPersistence();

    await act(() => {
      startSession();
    });

    await waitFor(() => {
      expect(useSessionPersistenceStore.getState().status).toBe('atRisk');
    });
    expect(useSessionPersistenceStore.getState().sessionId).toBe(firstDraftSessionId());
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
  });

  it('keeps a finished ride recoverable instead of resetting when the save fails', async () => {
    mockFinalizeSession.mockImplementation(() => {
      throw new Error('disk full');
    });

    await mountPersistence();

    await act(() => {
      startSession();
    });
    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });
    await rideOneSecond();

    let outcome: FinishSessionOutcome | undefined;
    await act(async () => {
      outcome = await finishSessionAndDisconnect();
    });

    expect(outcome?.status).toBe('unsaved');
    // The ride is still in memory, on the bike, and visible as unsaved: a failed
    // save must not look like a completed one.
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Finished);
    expect(useTrainingSessionStore.getState().elapsedSeconds).toBe(1);
    expect(useDeviceConnectionStore.getState().bikeAdapter).not.toBeNull();
    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(useSessionPersistenceStore.getState().status).toBe('unsaved');
  });

  it('retries the save under the same identity without duplicating rows', async () => {
    mockFinalizeSession.mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    await mountPersistence();

    await act(() => {
      startSession();
    });
    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });
    await rideOneSecond();

    await act(async () => {
      await finishSessionAndDisconnect();
    });
    expect(useSessionPersistenceStore.getState().status).toBe('unsaved');

    let retried: FinishSessionOutcome | undefined;
    await act(async () => {
      retried = await retryFinishSave();
    });

    const sessionId = firstDraftSessionId();
    expect(retried).toEqual({ status: 'completed', sessionId });
    // Same identity, one draft row, and the failed finalize simply repeated.
    expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    expect(mockFinalizeSession).toHaveBeenCalledTimes(2);
    expect(mockFinalizeSession.mock.calls[1]?.[0].sessionId).toBe(sessionId);
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    expect(useSessionPersistenceStore.getState().status).toBe('idle');
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('drops a failed sample write without buffering it and still saves the ride', async () => {
    mockAppendSample.mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    await mountPersistence();

    await act(() => {
      startSession();
    });
    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    await rideOneSecond();
    await rideOneSecond();

    await waitFor(() => {
      expect(useSessionPersistenceStore.getState().droppedSampleCount).toBe(1);
    });
    // Bounded handling: the failed second is counted and abandoned, never retried
    // and never queued behind the live ride.
    expect(mockAppendSample).toHaveBeenCalledTimes(2);
    expect(mockAppendSample.mock.calls.map((call) => call[0].sequence)).toEqual([0, 1]);

    let outcome: FinishSessionOutcome | undefined;
    await act(async () => {
      outcome = await finishSessionAndDisconnect();
    });

    expect(outcome).toEqual({ status: 'completed', sessionId: firstDraftSessionId() });
    expect(mockFinalizeSession).toHaveBeenCalledWith(expect.objectContaining({ elapsedSeconds: 2 }));
  });

  it('drops an unsaved ride only when the user explicitly discards it', async () => {
    mockFinalizeSession.mockImplementation(() => {
      throw new Error('disk full');
    });

    await mountPersistence();

    await act(() => {
      startSession();
    });
    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });
    await rideOneSecond();

    await act(async () => {
      await finishSessionAndDisconnect();
    });
    expect(mockDiscardDraftSession).not.toHaveBeenCalled();

    await act(async () => {
      await discardUnsavedSession();
    });

    expect(mockDiscardDraftSession).toHaveBeenCalledWith(firstDraftSessionId());
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    expect(useSessionPersistenceStore.getState().status).toBe('idle');
    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
  });

  it('reports a normal ride as saved and clears the persistence state', async () => {
    await mountPersistence();

    await act(() => {
      startSession();
    });
    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });
    expect(useSessionPersistenceStore.getState().status).toBe('recording');
    await rideOneSecond();

    let outcome: FinishSessionOutcome | undefined;
    await act(async () => {
      outcome = await finishSessionAndDisconnect();
    });

    expect(outcome).toEqual({ status: 'completed', sessionId: firstDraftSessionId() });
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Idle);
    expect(useSessionPersistenceStore.getState().status).toBe('idle');
    expect(mockDiscardDraftSession).not.toHaveBeenCalled();
  });
});
