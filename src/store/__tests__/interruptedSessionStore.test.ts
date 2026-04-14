import { useInterruptedSessionStore } from '../interruptedSessionStore';

describe('interruptedSessionStore', () => {
  beforeEach(() => {
    useInterruptedSessionStore.getState().clear();
  });

  it('stores and clears the interrupted session snapshot', () => {
    useInterruptedSessionStore.getState().setInterruptedSession({
      id: 'session-1',
      status: 'paused',
      startedAtMs: 100,
      endedAtMs: null,
      elapsedSeconds: 42,
      totalDistanceMeters: 1200,
      totalCaloriesKcal: 25,
      currentMetrics: {
        speed: 0,
        cadence: 0,
        power: 0,
        heartRate: null,
        resistance: null,
        distance: 1200,
      },
      savedBikeSnapshot: null,
      savedHrSnapshot: null,
      uploadState: null,
      createdAtMs: 100,
      updatedAtMs: 200,
    });

    expect(useInterruptedSessionStore.getState().interruptedSession?.id).toBe('session-1');

    useInterruptedSessionStore.getState().clear();

    expect(useInterruptedSessionStore.getState().interruptedSession).toBeNull();
  });
});
