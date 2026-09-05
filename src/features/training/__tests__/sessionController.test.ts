import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../store/trainingSessionStore';
import { BikeStatus } from '../../../services/ble/BikeAdapter';
import { TrainingPhase, type MetricSnapshot } from '../../../types/training';
import {
  pauseSession,
  resumeSession,
  restoreSession,
  startSession,
  syncSessionFromBikeStatus,
} from '../sessionController';

/**
 * Regression suite for audit A06: manual pause must outrank bike telemetry.
 *
 * `syncSessionFromBikeStatus` is the seam under test. A user-initiated pause
 * (from a screen or the Watch remote, both of which call `pauseSession`) must
 * survive a bike `Started` event until the user explicitly resumes; a
 * bike-driven pause (via `freezeActiveSession`, reached here through
 * `syncSessionFromBikeStatus` itself) remains eligible for bike-driven resume.
 */

const RESTORE_METRICS: MetricSnapshot = {
  speed: 0,
  cadence: 0,
  power: 0,
  heartRate: null,
  resistance: null,
  distance: 500,
};

function seedConnectedBike(): void {
  useDeviceConnectionStore.getState().setBikeAdapter({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeToMetrics: jest.fn(),
    setControlState: jest.fn().mockResolvedValue(undefined),
  });
}

describe('sessionController manual pause precedence (A06)', () => {
  beforeEach(() => {
    useDeviceConnectionStore.getState().clearAll();
    useTrainingSessionStore.getState().reset();
    seedConnectedBike();
  });

  it('keeps a manually paused session Paused when the bike reports Started', () => {
    startSession();
    pauseSession();
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);

    syncSessionFromBikeStatus(BikeStatus.Started);

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);
  });

  it('auto-resumes an eligible bike-driven pause when the bike reports Started', () => {
    startSession();
    // Bike-driven pause: the bike itself reports Paused, not a user pause command.
    syncSessionFromBikeStatus(BikeStatus.Paused);
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);

    syncSessionFromBikeStatus(BikeStatus.Started);

    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
  });

  it('clears the manual-pause reason on explicit Resume, so a later bike-driven pause can auto-resume', () => {
    startSession();
    pauseSession();
    resumeSession();
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);

    // A fresh bike-driven pause after the explicit resume is not manual.
    syncSessionFromBikeStatus(BikeStatus.Paused);
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);

    syncSessionFromBikeStatus(BikeStatus.Started);
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
  });

  it('requires an explicit Resume after restoring an interrupted session before a bike Started event can resume it', () => {
    restoreSession({
      elapsedSeconds: 120,
      totalDistance: 500,
      totalCalories: 10,
      currentMetrics: RESTORE_METRICS,
    });
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);

    syncSessionFromBikeStatus(BikeStatus.Started);
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Paused);

    resumeSession();
    expect(useTrainingSessionStore.getState().phase).toBe(TrainingPhase.Active);
  });
});
