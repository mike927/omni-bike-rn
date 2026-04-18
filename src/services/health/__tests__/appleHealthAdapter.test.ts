import { NativeModules } from 'react-native';

import { initWithWritePermissions, saveWorkout } from '../appleHealthAdapter';
import { AppleHealthWorkout } from 'apple-health-workout';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../types/sessionPersistence';

jest.mock('apple-health-workout', () => ({
  AppleHealthWorkout: {
    saveCyclingWorkout: jest.fn(),
  },
}));

const mockInit = jest.fn();
const mockGetAuthStatus = jest.fn();
const mockSaveCyclingWorkout = AppleHealthWorkout.saveCyclingWorkout as jest.Mock;

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
  NativeModules.AppleHealthKit = {
    initHealthKit: mockInit,
    getAuthStatus: mockGetAuthStatus,
  };
  mockGetAuthStatus.mockImplementation((_permissions, callback) =>
    callback(null, {
      permissions: {
        read: [],
        write: [2, 2, 2, 2],
      },
    }),
  );
});

describe('initWithWritePermissions', () => {
  it('resolves when native callback reports no error', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback(null));
    await expect(initWithWritePermissions()).resolves.toBeUndefined();
    const permissionsArg = mockInit.mock.calls[0][0];
    expect(permissionsArg.permissions.write).toEqual(['Workout', 'ActiveEnergyBurned', 'DistanceCycling', 'HeartRate']);
    expect(permissionsArg.permissions.read).toEqual([]);
  });

  it('rejects when native callback reports an error', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback('auth denied'));
    await expect(initWithWritePermissions()).rejects.toThrow('auth denied');
  });

  it('rejects when the native Apple Health module is unavailable', async () => {
    const originalAppleHealthKit = NativeModules.AppleHealthKit;
    NativeModules.AppleHealthKit = undefined;

    try {
      await expect(initWithWritePermissions()).rejects.toThrow(
        'Apple Health native module is unavailable. Rebuild the iOS app with the native dependency installed.',
      );
    } finally {
      NativeModules.AppleHealthKit = originalAppleHealthKit;
    }
  });
});

describe('saveWorkout', () => {
  it('maps session fields and HR samples to a saveCyclingWorkout payload, dropping non-positive HR', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-1');

    const samples = [buildSample(0, 120), buildSample(1, null), buildSample(2, 0), buildSample(3, 145)];

    const result = await saveWorkout(SESSION, samples);

    expect(result).toEqual({ workoutId: 'workout-uuid-1' });
    expect(mockSaveCyclingWorkout).toHaveBeenCalledWith({
      startDate: '2023-11-14T22:13:20.000Z',
      endDate: '2023-11-14T23:13:20.000Z',
      totalEnergyKcal: 450,
      totalDistanceMeters: 18000,
      heartRateSamples: [
        { bpm: 120, timestampMs: SESSION.startedAtMs },
        { bpm: 145, timestampMs: SESSION.startedAtMs + 3000 },
      ],
    });
  });

  it('falls back to startedAtMs + elapsedSeconds when endedAtMs is null', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-2');
    await saveWorkout({ ...SESSION, endedAtMs: null }, []);
    expect(mockSaveCyclingWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ endDate: '2023-11-14T23:13:20.000Z', heartRateSamples: [] }),
    );
  });

  it('rejects when the native module rejects', async () => {
    mockSaveCyclingWorkout.mockRejectedValue(new Error('not authorized'));
    await expect(saveWorkout(SESSION, [])).rejects.toThrow('not authorized');
  });
});
