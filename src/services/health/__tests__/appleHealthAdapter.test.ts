import { NativeModules } from 'react-native';

import { initWithWritePermissions, saveWorkout } from '../appleHealthAdapter';
import { AppleHealthWorkout } from 'apple-health-workout';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../types/sessionPersistence';

jest.mock('apple-health-workout', () => ({
  AppleHealthWorkout: {
    saveCyclingWorkout: jest.fn(),
    requestCyclingMetricsAuthorization: jest.fn(() => Promise.resolve()),
  },
}));

const mockInit = jest.fn();
const mockGetAuthStatus = jest.fn();
const mockSaveCyclingWorkout = AppleHealthWorkout.saveCyclingWorkout as jest.Mock;
const mockRequestCyclingAuth = AppleHealthWorkout.requestCyclingMetricsAuthorization as jest.Mock;

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

interface SampleOverrides {
  heartRate?: number | null;
  power?: number;
  cadence?: number;
  speed?: number;
}

function buildSample(index: number, overrides: SampleOverrides = {}): PersistedTrainingSample {
  return {
    id: `sample-${index}`,
    sessionId: 'session-1',
    sequence: index,
    recordedAtMs: SESSION.startedAtMs + index * 1000,
    elapsedSeconds: index,
    metrics: {
      speed: overrides.speed ?? 0,
      cadence: overrides.cadence ?? 0,
      power: overrides.power ?? 0,
      heartRate: overrides.heartRate === undefined ? null : overrides.heartRate,
      resistance: null,
      distance: null,
    },
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
  it('resolves when native callback reports no error and requests cycling metric auth', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback(null));
    await expect(initWithWritePermissions()).resolves.toBeUndefined();
    const permissionsArg = mockInit.mock.calls[0][0];
    expect(permissionsArg.permissions.write).toEqual(['Workout', 'ActiveEnergyBurned', 'DistanceCycling', 'HeartRate']);
    expect(permissionsArg.permissions.read).toEqual([]);
    expect(mockRequestCyclingAuth).toHaveBeenCalledTimes(1);
  });

  it('rejects when cycling metric authorization fails', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback(null));
    mockRequestCyclingAuth.mockRejectedValueOnce(new Error('cycling denied'));
    await expect(initWithWritePermissions()).rejects.toThrow('cycling denied');
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
  it('maps session fields + HR, power, cadence, and speed samples, dropping non-positive HR and converting speed km/h to m/s', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-1');

    const samples = [
      buildSample(0, { heartRate: 120, power: 180, cadence: 85, speed: 36 }),
      buildSample(1, { heartRate: null, power: 200, cadence: 90, speed: 36 }),
      buildSample(2, { heartRate: 0, power: 0, cadence: 0, speed: 0 }),
      buildSample(3, { heartRate: 145, power: 220, cadence: 92, speed: 40 }),
    ];

    const result = await saveWorkout(SESSION, samples);

    expect(result).toEqual({ workoutId: 'workout-uuid-1' });
    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload).toMatchObject({
      startDate: '2023-11-14T22:13:20.000Z',
      endDate: '2023-11-14T23:13:20.000Z',
      totalEnergyKcal: 450,
      totalDistanceMeters: 18000,
      heartRateSamples: [
        { bpm: 120, timestampMs: SESSION.startedAtMs },
        { bpm: 145, timestampMs: SESSION.startedAtMs + 3000 },
      ],
      cyclingPowerSamples: [
        { value: 180, timestampMs: SESSION.startedAtMs },
        { value: 200, timestampMs: SESSION.startedAtMs + 1000 },
        { value: 0, timestampMs: SESSION.startedAtMs + 2000 },
        { value: 220, timestampMs: SESSION.startedAtMs + 3000 },
      ],
      cyclingCadenceSamples: [
        { value: 85, timestampMs: SESSION.startedAtMs },
        { value: 90, timestampMs: SESSION.startedAtMs + 1000 },
        { value: 0, timestampMs: SESSION.startedAtMs + 2000 },
        { value: 92, timestampMs: SESSION.startedAtMs + 3000 },
      ],
    });
    // Speed samples: 36 km/h -> 10 m/s, 40 km/h -> ~11.111 m/s
    expect(payload.cyclingSpeedSamples).toHaveLength(4);
    expect(payload.cyclingSpeedSamples[0]).toEqual({ value: 10, timestampMs: SESSION.startedAtMs });
    expect(payload.cyclingSpeedSamples[3].value).toBeCloseTo(40 / 3.6, 10);
  });

  it('falls back to startedAtMs + elapsedSeconds when endedAtMs is null', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-2');
    await saveWorkout({ ...SESSION, endedAtMs: null }, []);
    expect(mockSaveCyclingWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        endDate: '2023-11-14T23:13:20.000Z',
        heartRateSamples: [],
        cyclingPowerSamples: [],
        cyclingCadenceSamples: [],
        cyclingSpeedSamples: [],
      }),
    );
  });

  it('rejects when the native module rejects', async () => {
    mockSaveCyclingWorkout.mockRejectedValue(new Error('not authorized'));
    await expect(saveWorkout(SESSION, [])).rejects.toThrow('not authorized');
  });
});
