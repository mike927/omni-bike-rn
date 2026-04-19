import { NativeModules } from 'react-native';

import {
  __resetHealthKitInitPromiseForTests,
  getBiologicalSex,
  getDateOfBirth,
  getLatestHeightCm,
  getLatestWeightKg,
  initWithWritePermissions,
  loadProfileFromAppleHealth,
  saveWorkout,
} from '../appleHealthAdapter';
import { AppleHealthWorkout } from 'apple-health-workout';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../../types/sessionPersistence';
import { useUserProfileStore } from '../../../store/userProfileStore';
import { EMPTY_USER_PROFILE } from '../../../types/userProfile';

jest.mock('../../../services/profile/userProfileStorage', () => ({
  loadUserProfile: jest.fn().mockResolvedValue({
    sex: null,
    dateOfBirth: null,
    weightKg: null,
    heightCm: null,
    sources: {},
  }),
  saveUserProfile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('apple-health-workout', () => ({
  AppleHealthWorkout: {
    saveCyclingWorkout: jest.fn(),
    requestCyclingMetricsAuthorization: jest.fn(() => Promise.resolve()),
    queryBasalEnergyKcal: jest.fn(() => Promise.resolve(0)),
  },
}));

const mockInit = jest.fn();
const mockGetAuthStatus = jest.fn();
const mockGetBiologicalSex = jest.fn();
const mockGetDateOfBirth = jest.fn();
const mockGetLatestWeight = jest.fn();
const mockGetLatestHeight = jest.fn();
const mockSaveCyclingWorkout = AppleHealthWorkout.saveCyclingWorkout as jest.Mock;
const mockRequestCyclingAuth = AppleHealthWorkout.requestCyclingMetricsAuthorization as jest.Mock;
const mockQueryBasalEnergyKcal = AppleHealthWorkout.queryBasalEnergyKcal as jest.Mock;

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
  __resetHealthKitInitPromiseForTests();
  NativeModules.AppleHealthKit = {
    initHealthKit: mockInit,
    getAuthStatus: mockGetAuthStatus,
    getBiologicalSex: mockGetBiologicalSex,
    getDateOfBirth: mockGetDateOfBirth,
    getLatestWeight: mockGetLatestWeight,
    getLatestHeight: mockGetLatestHeight,
  };
  mockGetAuthStatus.mockImplementation((_permissions, callback) =>
    callback(null, {
      permissions: {
        read: [],
        write: [2, 2, 2, 2],
      },
    }),
  );
  // Default: native basal query returns 0 so Apple Fitness renders Active = Total
  // for tests that don't care about the split.
  mockQueryBasalEnergyKcal.mockResolvedValue(0);
  // Default: empty profile so the Mifflin fallback is inactive unless a test
  // explicitly opts in by populating the store.
  useUserProfileStore.setState({ profile: { ...EMPTY_USER_PROFILE, sources: {} }, hydrated: true });
});

describe('initWithWritePermissions', () => {
  it('resolves when native callback reports no error and requests cycling metric auth', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback(null));
    await expect(initWithWritePermissions()).resolves.toBeUndefined();
    const permissionsArg = mockInit.mock.calls[0][0];
    expect(permissionsArg.permissions.write).toEqual([
      'Workout',
      'ActiveEnergyBurned',
      'DistanceCycling',
      'HeartRate',
      'BasalEnergyBurned',
    ]);
    expect(permissionsArg.permissions.read).toEqual([
      'BasalEnergyBurned',
      'BiologicalSex',
      'DateOfBirth',
      'Weight',
      'Height',
    ]);
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
      activeEnergyKcal: 450,
      basalEnergyKcal: 0,
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

  it('queries basal energy via the native module (source-filtered) and forwards the value', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-3');
    mockQueryBasalEnergyKcal.mockResolvedValue(12);

    await saveWorkout(SESSION, []);

    expect(mockQueryBasalEnergyKcal).toHaveBeenCalledWith({
      startDate: '2023-11-14T22:13:20.000Z',
      endDate: '2023-11-14T23:13:20.000Z',
    });
    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload).toMatchObject({ activeEnergyKcal: 450, basalEnergyKcal: 12 });
  });

  it('passes basalEnergyKcal=0 when the native basal query rejects (no upload failure)', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-4');
    mockQueryBasalEnergyKcal.mockRejectedValue(new Error('HealthKit read failed'));

    await expect(saveWorkout(SESSION, [])).resolves.toEqual({ workoutId: 'workout-uuid-4' });

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload).toMatchObject({ activeEnergyKcal: 450, basalEnergyKcal: 0 });
  });

  it('passes basalEnergyKcal=0 when HealthKit returns zero basal for the interval', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-5');
    mockQueryBasalEnergyKcal.mockResolvedValue(0);

    await saveWorkout(SESSION, []);

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload).toMatchObject({ activeEnergyKcal: 450, basalEnergyKcal: 0 });
  });

  // Regression: re-exporting the same session used to compound because the
  // previous save's basal sample was read back and summed in. The native
  // query now excludes this app's own writes, so the second save reads the
  // same system-basal value as the first.
  it('does not compound basal energy when the same session is exported twice', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-repeat');
    mockQueryBasalEnergyKcal.mockResolvedValue(100);

    await saveWorkout(SESSION, []);
    await saveWorkout(SESSION, []);

    expect(mockQueryBasalEnergyKcal).toHaveBeenCalledTimes(2);
    const firstPayload = mockSaveCyclingWorkout.mock.calls[0][0];
    const secondPayload = mockSaveCyclingWorkout.mock.calls[1][0];
    expect(firstPayload).toMatchObject({ basalEnergyKcal: 100 });
    expect(secondPayload).toMatchObject({ basalEnergyKcal: 100 });
  });

  it('uses Mifflin–St Jeor as a basal fallback when HealthKit returns 0 and the profile is complete', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-mifflin');
    mockQueryBasalEnergyKcal.mockResolvedValue(0);
    useUserProfileStore.setState({
      profile: {
        sex: 'male',
        dateOfBirth: '1990-01-01',
        weightKg: 80,
        heightCm: 178,
        sources: { sex: 'manual', dateOfBirth: 'manual', weightKg: 'manual', heightCm: 'manual' },
      },
      hydrated: true,
    });

    await saveWorkout(SESSION, []);

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    // Mifflin BMR for the inputs above is ~1817 kcal/day. Over a 1-hour window
    // (3600 s of the SESSION fixture) that's ~75.7 kcal — assert a permissive
    // band so age-rounding via deriveAgeYears doesn't make this brittle.
    expect(payload.basalEnergyKcal).toBeGreaterThan(60);
    expect(payload.basalEnergyKcal).toBeLessThan(95);
  });

  it('passes through HealthKit basal even when the profile is complete (HK is the source of truth)', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-hk-wins');
    mockQueryBasalEnergyKcal.mockResolvedValue(50);
    useUserProfileStore.setState({
      profile: {
        sex: 'male',
        dateOfBirth: '1990-01-01',
        weightKg: 80,
        heightCm: 178,
        sources: { sex: 'manual', dateOfBirth: 'manual', weightKg: 'manual', heightCm: 'manual' },
      },
      hydrated: true,
    });

    await saveWorkout(SESSION, []);

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload).toMatchObject({ basalEnergyKcal: 50 });
  });

  it('passes basalEnergyKcal=0 when HealthKit returns 0 and the profile is incomplete', async () => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-no-profile');
    mockQueryBasalEnergyKcal.mockResolvedValue(0);
    useUserProfileStore.setState({
      profile: { sex: 'male', dateOfBirth: null, weightKg: 80, heightCm: 178, sources: {} },
      hydrated: true,
    });

    await saveWorkout(SESSION, []);

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload).toMatchObject({ basalEnergyKcal: 0 });
  });
});

describe('profile reads', () => {
  it('getBiologicalSex returns "male" / "female" and null otherwise', async () => {
    mockGetBiologicalSex.mockImplementationOnce((_o, cb) => cb(null, { value: 'male' }));
    expect(await getBiologicalSex()).toBe('male');
    mockGetBiologicalSex.mockImplementationOnce((_o, cb) => cb(null, { value: 'female' }));
    expect(await getBiologicalSex()).toBe('female');
    mockGetBiologicalSex.mockImplementationOnce((_o, cb) => cb(null, { value: 'other' }));
    expect(await getBiologicalSex()).toBeNull();
    mockGetBiologicalSex.mockImplementationOnce((_o, cb) => cb(null, { value: 'unknown' }));
    expect(await getBiologicalSex()).toBeNull();
    mockGetBiologicalSex.mockImplementationOnce((_o, cb) => cb('denied', null as never));
    expect(await getBiologicalSex()).toBeNull();
  });

  it('getDateOfBirth slices to yyyy-mm-dd and returns null on absent or empty value', async () => {
    mockGetDateOfBirth.mockImplementationOnce((_o, cb) => cb(null, { value: '1985-03-10T00:00:00.000Z', age: 41 }));
    expect(await getDateOfBirth()).toBe('1985-03-10');
    mockGetDateOfBirth.mockImplementationOnce((_o, cb) => cb(null, { value: null, age: null }));
    expect(await getDateOfBirth()).toBeNull();
    mockGetDateOfBirth.mockImplementationOnce((_o, cb) => cb('boom', null as never));
    expect(await getDateOfBirth()).toBeNull();
  });

  it('getLatestWeightKg requests kg unit and returns positive numbers, null otherwise', async () => {
    mockGetLatestWeight.mockImplementationOnce((opts, cb) => {
      expect(opts).toEqual({ unit: 'kg' });
      cb(null, { value: 80.5 });
    });
    expect(await getLatestWeightKg()).toBe(80.5);
    mockGetLatestWeight.mockImplementationOnce((_o, cb) => cb(null, { value: 0 }));
    expect(await getLatestWeightKg()).toBeNull();
    mockGetLatestWeight.mockImplementationOnce((_o, cb) => cb('no sample', null as never));
    expect(await getLatestWeightKg()).toBeNull();
  });

  it('getLatestHeightCm requests cm unit and returns positive numbers, null otherwise', async () => {
    mockGetLatestHeight.mockImplementationOnce((opts, cb) => {
      expect(opts).toEqual({ unit: 'cm' });
      cb(null, { value: 178 });
    });
    expect(await getLatestHeightCm()).toBe(178);
    mockGetLatestHeight.mockImplementationOnce((_o, cb) => cb(null, { value: 0 }));
    expect(await getLatestHeightCm()).toBeNull();
    mockGetLatestHeight.mockImplementationOnce((_o, cb) => cb('no sample', null as never));
    expect(await getLatestHeightCm()).toBeNull();
  });

  it('loadProfileFromAppleHealth aggregates only the populated fields', async () => {
    mockInit.mockImplementation((_permissions, callback) => callback(null));
    mockGetBiologicalSex.mockImplementation((_o, cb) => cb(null, { value: 'male' }));
    mockGetDateOfBirth.mockImplementation((_o, cb) => cb(null, { value: '1985-03-10T00:00:00.000Z', age: 41 }));
    mockGetLatestWeight.mockImplementation((_o, cb) => cb(null, { value: 80 }));
    mockGetLatestHeight.mockImplementation((_o, cb) => cb('no sample', null as never));

    const partial = await loadProfileFromAppleHealth();
    expect(partial).toEqual({ sex: 'male', dateOfBirth: '1985-03-10', weightKg: 80 });
  });

  it('loadProfileFromAppleHealth awaits init before reading characteristics', async () => {
    const callOrder: string[] = [];
    mockInit.mockImplementation((_permissions, callback) => {
      callOrder.push('init');
      setTimeout(() => callback(null), 0);
    });
    mockGetBiologicalSex.mockImplementation((_o, cb) => {
      callOrder.push('getBiologicalSex');
      cb(null, { value: 'female' });
    });
    mockGetDateOfBirth.mockImplementation((_o, cb) => cb(null, { value: '1990-01-01T00:00:00.000Z', age: 36 }));
    mockGetLatestWeight.mockImplementation((_o, cb) => cb(null, { value: 60 }));
    mockGetLatestHeight.mockImplementation((_o, cb) => cb(null, { value: 165 }));

    await loadProfileFromAppleHealth();
    expect(callOrder[0]).toBe('init');
    expect(callOrder).toContain('getBiologicalSex');
    expect(callOrder.indexOf('init')).toBeLessThan(callOrder.indexOf('getBiologicalSex'));
  });

  it('initWithWritePermissions memoizes a single in-flight prompt across concurrent callers', async () => {
    mockInit.mockImplementation((_permissions, callback) => setTimeout(() => callback(null), 0));
    mockGetBiologicalSex.mockImplementation((_o, cb) => cb(null, { value: 'male' }));
    mockGetDateOfBirth.mockImplementation((_o, cb) => cb(null, { value: '1985-03-10T00:00:00.000Z', age: 41 }));
    mockGetLatestWeight.mockImplementation((_o, cb) => cb(null, { value: 80 }));
    mockGetLatestHeight.mockImplementation((_o, cb) => cb(null, { value: 180 }));

    await Promise.all([initWithWritePermissions(), loadProfileFromAppleHealth(), initWithWritePermissions()]);
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockRequestCyclingAuth).toHaveBeenCalledTimes(1);
  });
});
