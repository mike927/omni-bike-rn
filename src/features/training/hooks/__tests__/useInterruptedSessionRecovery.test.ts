import { renderHook } from '@testing-library/react-native';

import { useInterruptedSessionRecovery } from '../useInterruptedSessionRecovery';
import { useInterruptedSessionStore } from '../../../../store/interruptedSessionStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { TrainingPhase } from '../../../../types/training';
import * as trainingSessionRepository from '../../../../services/db/trainingSessionRepository';

jest.mock('../../../../services/db/trainingSessionRepository', () => ({
  finalizeStaleOpenSessions: jest.fn(),
  getLatestOpenSession: jest.fn(),
  normalizeRecoveredSessionToPaused: jest.fn(),
  STALE_SESSION_MAX_AGE_MS: 24 * 60 * 60 * 1000,
}));

describe('useInterruptedSessionRecovery', () => {
  const mockFinalizeStaleOpenSessions = trainingSessionRepository.finalizeStaleOpenSessions as jest.MockedFunction<
    typeof trainingSessionRepository.finalizeStaleOpenSessions
  >;
  const mockGetLatestOpenSession = trainingSessionRepository.getLatestOpenSession as jest.MockedFunction<
    typeof trainingSessionRepository.getLatestOpenSession
  >;
  const mockNormalizeRecoveredSessionToPaused =
    trainingSessionRepository.normalizeRecoveredSessionToPaused as jest.MockedFunction<
      typeof trainingSessionRepository.normalizeRecoveredSessionToPaused
    >;

  beforeEach(() => {
    jest.clearAllMocks();
    useInterruptedSessionStore.getState().clear();
    useTrainingSessionStore.setState({
      phase: TrainingPhase.Idle,
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      initialDistance: null,
      bikeCaloriesOffset: null,
      lastBikeTotalEnergyKcal: null,
      lastBikeDistance: null,
      lastCalorieSourceMode: 'none',
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    });
    mockFinalizeStaleOpenSessions.mockReturnValue([]);
    mockGetLatestOpenSession.mockReturnValue(null);
    mockNormalizeRecoveredSessionToPaused.mockReturnValue(null);
  });

  it('runs the stale-session sweep when enabled', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234);

    renderHook(() => useInterruptedSessionRecovery(true));

    expect(mockFinalizeStaleOpenSessions).toHaveBeenCalledWith(
      1234,
      trainingSessionRepository.STALE_SESSION_MAX_AGE_MS,
    );

    nowSpy.mockRestore();
  });

  it('stores the latest paused interrupted session for Home recovery', () => {
    mockGetLatestOpenSession.mockReturnValue({
      id: 'session-1',
      status: 'paused',
      startedAtMs: 100,
      endedAtMs: null,
      elapsedSeconds: 90,
      totalDistanceMeters: 2000,
      totalCaloriesKcal: 40,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: 2000 },
      savedBikeSnapshot: null,
      savedHrSnapshot: null,
      uploadState: null,
      createdAtMs: 100,
      updatedAtMs: 300,
    });

    renderHook(() => useInterruptedSessionRecovery(true));

    expect(useInterruptedSessionStore.getState().interruptedSession?.id).toBe('session-1');
  });

  it('normalizes recovered active sessions before exposing them', () => {
    mockGetLatestOpenSession.mockReturnValue({
      id: 'session-active',
      status: 'active',
      startedAtMs: 100,
      endedAtMs: null,
      elapsedSeconds: 90,
      totalDistanceMeters: 2000,
      totalCaloriesKcal: 40,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: 2000 },
      savedBikeSnapshot: null,
      savedHrSnapshot: null,
      uploadState: null,
      createdAtMs: 100,
      updatedAtMs: 300,
    });
    mockNormalizeRecoveredSessionToPaused.mockReturnValue({
      id: 'session-active',
      status: 'paused',
      startedAtMs: 100,
      endedAtMs: null,
      elapsedSeconds: 90,
      totalDistanceMeters: 2000,
      totalCaloriesKcal: 40,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: 2000 },
      savedBikeSnapshot: null,
      savedHrSnapshot: null,
      uploadState: null,
      createdAtMs: 100,
      updatedAtMs: 300,
    });

    renderHook(() => useInterruptedSessionRecovery(true));

    expect(mockNormalizeRecoveredSessionToPaused).toHaveBeenCalledWith('session-active');
    expect(useInterruptedSessionStore.getState().interruptedSession?.status).toBe('paused');
  });

  it('skips recovery when an in-memory session is already active', () => {
    useTrainingSessionStore.setState({ phase: TrainingPhase.Active });

    renderHook(() => useInterruptedSessionRecovery(true));

    expect(mockFinalizeStaleOpenSessions).not.toHaveBeenCalled();
    expect(mockGetLatestOpenSession).not.toHaveBeenCalled();
  });
});
