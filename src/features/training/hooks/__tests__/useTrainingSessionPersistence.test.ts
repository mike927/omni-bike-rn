import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  getActiveSessionId,
  seedFromPersistedSession,
  useTrainingSessionPersistence,
} from '../useTrainingSessionPersistence';
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

describe('useTrainingSessionPersistence', () => {
  const mockCreateDraftSession = trainingSessionRepository.createDraftSession as jest.MockedFunction<
    typeof trainingSessionRepository.createDraftSession
  >;
  const mockAppendSample = trainingSessionRepository.appendSample as jest.MockedFunction<
    typeof trainingSessionRepository.appendSample
  >;
  const mockUpdateSessionStatus = trainingSessionRepository.updateSessionStatus as jest.MockedFunction<
    typeof trainingSessionRepository.updateSessionStatus
  >;
  const mockFinalizeSession = trainingSessionRepository.finalizeSession as jest.MockedFunction<
    typeof trainingSessionRepository.finalizeSession
  >;
  const mockDiscardDraftSession = trainingSessionRepository.discardDraftSession as jest.MockedFunction<
    typeof trainingSessionRepository.discardDraftSession
  >;

  const sample: MetricSnapshot = {
    speed: 25,
    cadence: 80,
    power: 180,
    heartRate: 145,
    resistance: 7,
    distance: 525,
  };

  const tickInput: TrainingTickInput = {
    metrics: sample,
    bikeTotalEnergyKcal: null,
    watchActiveKcal: null,
    hasLiveExternalHr: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTrainingSessionStore.setState({
      phase: TrainingPhase.Idle,
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      initialDistance: null,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      lastBikeDistance: null,
      watchCaloriesOffset: null,
      lastWatchActiveKcal: null,
      lastCalorieSourceMode: 'none',
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    });
    useSavedGearStore.setState({
      savedBike: { id: 'bike-1', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-1', name: 'Garmin HRM', type: 'hr' },
      hydrated: true,
      bikeReconnectState: 'connected',
      hrReconnectState: 'connected',
      bikeAutoReconnectSuppressed: false,
      hrAutoReconnectSuppressed: false,
    });
  });

  it('creates one draft session when training starts', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });
  });

  it('appends one sample per active tick', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useTrainingSessionStore.getState().tick(tickInput);
    });

    await waitFor(() => {
      expect(mockAppendSample).toHaveBeenCalledTimes(1);
    });
  });

  it('does not create a duplicate draft when resuming', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().pause();
      useTrainingSessionStore.getState().resume();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateSessionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }));
    expect(mockUpdateSessionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
  });

  it('finalizes the session when training finishes', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useTrainingSessionStore.getState().tick(tickInput);
      useTrainingSessionStore.getState().finish();
    });

    await waitFor(() => {
      expect(mockFinalizeSession).toHaveBeenCalledTimes(1);
    });
  });

  it('deletes the draft when reset happens before finish', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useTrainingSessionStore.getState().tick(tickInput);
      useTrainingSessionStore.getState().reset();
    });

    await waitFor(() => {
      expect(mockDiscardDraftSession).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the completed session when reset happens after finish', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useTrainingSessionStore.getState().tick(tickInput);
      useTrainingSessionStore.getState().finish();
      useTrainingSessionStore.getState().reset();
    });

    await waitFor(() => {
      expect(mockFinalizeSession).toHaveBeenCalledTimes(1);
    });

    expect(mockDiscardDraftSession).not.toHaveBeenCalled();
  });

  it('does not persist anything while disabled', async () => {
    renderHook(() => useTrainingSessionPersistence(false));

    act(() => {
      useTrainingSessionStore.getState().start();
      useTrainingSessionStore.getState().tick(tickInput);
      useTrainingSessionStore.getState().finish();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).not.toHaveBeenCalled();
    });

    expect(mockAppendSample).not.toHaveBeenCalled();
    expect(mockFinalizeSession).not.toHaveBeenCalled();
  });

  it('increments sequence number on each tick', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useTrainingSessionStore.getState().tick(tickInput);
      useTrainingSessionStore.getState().tick(tickInput);
      useTrainingSessionStore.getState().tick(tickInput);
    });

    await waitFor(() => {
      expect(mockAppendSample).toHaveBeenCalledTimes(3);
    });

    expect(mockAppendSample).toHaveBeenNthCalledWith(1, expect.objectContaining({ sequence: 0 }));
    expect(mockAppendSample).toHaveBeenNthCalledWith(2, expect.objectContaining({ sequence: 1 }));
    expect(mockAppendSample).toHaveBeenNthCalledWith(3, expect.objectContaining({ sequence: 2 }));
  });

  it('does not append samples if draft session creation fails', async () => {
    mockCreateDraftSession.mockImplementation(() => {
      throw new Error('disk full');
    });

    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().start();
    });

    await waitFor(() => {
      expect(mockCreateDraftSession).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useTrainingSessionStore.getState().tick(tickInput);
    });

    await waitFor(() => {
      expect(mockAppendSample).not.toHaveBeenCalled();
    });
  });

  it('continues a restored session sequence when the hook is already mounted', async () => {
    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      seedFromPersistedSession('restored-session', 3);
      useTrainingSessionStore.setState({
        phase: TrainingPhase.Paused,
        elapsedSeconds: 12,
        totalDistance: 120,
        totalCalories: 8,
        currentMetrics: sample,
      });
    });

    act(() => {
      useTrainingSessionStore.getState().resume();
      useTrainingSessionStore.getState().tick(tickInput);
    });

    await waitFor(() => {
      expect(mockUpdateSessionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'restored-session', status: 'active' }),
      );
    });

    await waitFor(() => {
      expect(mockAppendSample).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'restored-session', sequence: 4 }),
      );
    });

    expect(getActiveSessionId()).toBe('restored-session');
  });

  it('consumes a queued persisted seed when the hook mounts later', async () => {
    act(() => {
      seedFromPersistedSession('queued-session', 1);
      useTrainingSessionStore.setState({
        phase: TrainingPhase.Paused,
        elapsedSeconds: 7,
        totalDistance: 70,
        totalCalories: 4,
        currentMetrics: sample,
      });
    });

    renderHook(() => useTrainingSessionPersistence());

    act(() => {
      useTrainingSessionStore.getState().resume();
      useTrainingSessionStore.getState().tick(tickInput);
    });

    await waitFor(() => {
      expect(mockAppendSample).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'queued-session', sequence: 2 }),
      );
    });
  });
});
