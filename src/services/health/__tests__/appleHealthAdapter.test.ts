import AppleHealthKit from 'react-native-health';

import { initWithWritePermissions, saveWorkout } from '../appleHealthAdapter';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../types/sessionPersistence';

jest.mock('react-native-health', () => {
  return {
    __esModule: true,
    default: {
      initHealthKit: jest.fn(),
      saveWorkout: jest.fn(),
      saveHeartRateSample: jest.fn(),
      Constants: {
        Activities: { Cycling: 'Cycling' },
        Permissions: {
          Workout: 'Workout',
          HeartRate: 'HeartRate',
          ActiveEnergyBurned: 'ActiveEnergyBurned',
          DistanceCycling: 'DistanceCycling',
        },
        Units: { bpm: 'bpm', kilocalorie: 'kilocalorie', meter: 'meter' },
      },
    },
  };
});

const mockInit = AppleHealthKit.initHealthKit as unknown as jest.Mock;
const mockSaveWorkout = AppleHealthKit.saveWorkout as unknown as jest.Mock;
const mockSaveHr = AppleHealthKit.saveHeartRateSample as unknown as jest.Mock;

const SESSION: PersistedTrainingSession = {
  id: 'session-1',
  status: 'finished',
  startedAtMs: 1_700_000_000_000,
  endedAtMs: 1_700_003_600_000,
  elapsedSeconds: 3600,
  totalDistanceMeters: 18000,
  totalCaloriesKcal: 450,
  currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
  savedBikeSnapshot: null,
  savedHrSnapshot: null,
  uploadState: null,
  createdAtMs: 1_700_000_000_000,
  updatedAtMs: 1_700_003_600_000,
};

function buildSample(index: number, heartRate: number | null): PersistedTrainingSample {
  return {
    id: `sample-${index}`,
    sessionId: 'session-1',
    sequence: index,
    recordedAtMs: SESSION.startedAtMs + index * 1000,
    elapsedSeconds: index,
    metrics: { speed: 0, cadence: 0, power: 0, heartRate, resistance: null, distance: null },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initWithWritePermissions', () => {
  it('resolves when native callback reports no error', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback(null));
    await expect(initWithWritePermissions()).resolves.toBeUndefined();
    const permissionsArg = mockInit.mock.calls[0][0];
    expect(permissionsArg.permissions.write).toEqual(['Workout', 'HeartRate', 'ActiveEnergyBurned', 'DistanceCycling']);
    expect(permissionsArg.permissions.read).toEqual([]);
  });

  it('rejects when native callback reports an error', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback('auth denied'));
    await expect(initWithWritePermissions()).rejects.toThrow('auth denied');
  });
});

describe('saveWorkout', () => {
  it('maps session fields to an HKWorkout payload and saves every non-null HR sample', async () => {
    mockSaveWorkout.mockImplementation((_options, callback) => callback(null, 'workout-uuid-1'));
    mockSaveHr.mockImplementation((_options, callback) => callback(null));

    const samples = [buildSample(0, 120), buildSample(1, null), buildSample(2, 0), buildSample(3, 145)];

    const result = await saveWorkout(SESSION, samples);

    expect(result).toEqual({ workoutId: 'workout-uuid-1', attemptedHrSampleCount: 2, failedHrSampleCount: 0 });

    const workoutOptions = mockSaveWorkout.mock.calls[0][0];
    expect(workoutOptions).toMatchObject({
      type: 'Cycling',
      startDate: '2023-11-14T22:13:20.000Z',
      endDate: '2023-11-14T23:13:20.000Z',
      energyBurned: 450,
      energyBurnedUnit: 'kilocalorie',
      distance: 18000,
      distanceUnit: 'meter',
    });

    expect(mockSaveHr).toHaveBeenCalledTimes(2);
    expect(mockSaveHr.mock.calls[0][0]).toMatchObject({
      value: 120,
      date: new Date(SESSION.startedAtMs).toISOString(),
      unit: 'bpm',
    });
    expect(mockSaveHr.mock.calls[1][0]).toMatchObject({
      value: 145,
      date: new Date(SESSION.startedAtMs + 3000).toISOString(),
      unit: 'bpm',
    });
  });

  it('falls back to startedAtMs + elapsedSeconds when endedAtMs is null', async () => {
    mockSaveWorkout.mockImplementation((_options, callback) => callback(null, 'workout-uuid-2'));
    await saveWorkout({ ...SESSION, endedAtMs: null }, []);
    const workoutOptions = mockSaveWorkout.mock.calls[0][0];
    expect(workoutOptions.endDate).toBe('2023-11-14T23:13:20.000Z');
  });

  it('rejects when saveWorkout native callback reports an error', async () => {
    mockSaveWorkout.mockImplementation((_options, callback) => callback('not authorized', null));
    await expect(saveWorkout(SESSION, [])).rejects.toThrow('not authorized');
  });

  it('reports failed HR samples without rejecting the whole save', async () => {
    mockSaveWorkout.mockImplementation((_options, callback) => callback(null, 'workout-uuid-3'));
    mockSaveHr
      .mockImplementationOnce((_options, callback) => callback(null))
      .mockImplementationOnce((_options, callback) => callback('hr save failed'))
      .mockImplementationOnce((_options, callback) => callback(null));

    const result = await saveWorkout(SESSION, [buildSample(0, 100), buildSample(1, 110), buildSample(2, 120)]);

    expect(result).toEqual({
      workoutId: 'workout-uuid-3',
      attemptedHrSampleCount: 3,
      failedHrSampleCount: 1,
    });
  });
});
