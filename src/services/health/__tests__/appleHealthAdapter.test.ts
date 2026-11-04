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

let mockAppleHealthAvailable = true;

jest.mock('apple-health-workout', () => ({
  get isAppleHealthWorkoutAvailable() {
    return mockAppleHealthAvailable;
  },
  AppleHealthWorkout: {
    saveCyclingWorkout: jest.fn(),
    requestHealthKitAuthorization: jest.fn(() => Promise.resolve()),
    queryBasalEnergyKcal: jest.fn(() => Promise.resolve(0)),
    getBiologicalSex: jest.fn(() => Promise.resolve(null)),
    getDateOfBirth: jest.fn(() => Promise.resolve(null)),
    getLatestWeightKg: jest.fn(() => Promise.resolve(null)),
    getLatestHeightCm: jest.fn(() => Promise.resolve(null)),
    getWriteAuthorizationStatus: jest.fn(() => ({ HKWorkoutTypeIdentifier: 2 })),
  },
}));

const mockGetBiologicalSex = AppleHealthWorkout.getBiologicalSex as jest.Mock;
const mockGetDateOfBirth = AppleHealthWorkout.getDateOfBirth as jest.Mock;
const mockGetLatestWeight = AppleHealthWorkout.getLatestWeightKg as jest.Mock;
const mockGetLatestHeight = AppleHealthWorkout.getLatestHeightCm as jest.Mock;
const mockSaveCyclingWorkout = AppleHealthWorkout.saveCyclingWorkout as jest.Mock;
const mockRequestAuth = AppleHealthWorkout.requestHealthKitAuthorization as jest.Mock;
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
  mockAppleHealthAvailable = true;
  jest.clearAllMocks();
  __resetHealthKitInitPromiseForTests();
  delete NativeModules.AppleHealthKit;
  mockRequestAuth.mockResolvedValue(undefined);
  mockGetBiologicalSex.mockResolvedValue(null);
  mockGetDateOfBirth.mockResolvedValue(null);
  mockGetLatestWeight.mockResolvedValue(null);
  mockGetLatestHeight.mockResolvedValue(null);
  // Default: native basal query returns 0 so Apple Fitness renders Active = Total
  // for tests that don't care about the split.
  mockQueryBasalEnergyKcal.mockResolvedValue(0);
  // Default: empty profile so the Mifflin fallback is inactive unless a test
  // explicitly opts in by populating the store.
  useUserProfileStore.setState({ profile: { ...EMPTY_USER_PROFILE, sources: {} }, hydrated: true });
});

describe('initWithWritePermissions', () => {
  it('requests authorization through a single native sheet without the legacy module', async () => {
    await expect(initWithWritePermissions()).resolves.toBeUndefined();
    expect(mockRequestAuth).toHaveBeenCalledTimes(1);
  });

  it('rejects when native authorization fails', async () => {
    mockRequestAuth.mockRejectedValueOnce(new Error('auth denied'));
    await expect(initWithWritePermissions()).rejects.toThrow('auth denied');
  });

  it('keeps authorization successful when optional write-status diagnostics fail', async () => {
    (AppleHealthWorkout.getWriteAuthorizationStatus as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Status unavailable');
    });

    await expect(initWithWritePermissions()).resolves.toBeUndefined();
  });

  it('clears the memoized promise on failure so a later attempt can retry', async () => {
    mockRequestAuth.mockRejectedValueOnce(new Error('first attempt denied'));
    await expect(initWithWritePermissions()).rejects.toThrow('first attempt denied');

    mockRequestAuth.mockResolvedValueOnce(undefined);
    await expect(initWithWritePermissions()).resolves.toBeUndefined();
    expect(mockRequestAuth).toHaveBeenCalledTimes(2);
  });

  it('rejects with the iOS-only message when Apple Health is unavailable (Android)', async () => {
    mockAppleHealthAvailable = false;
    await expect(initWithWritePermissions()).rejects.toThrow('Apple Health is only available on iOS.');
    expect(mockRequestAuth).not.toHaveBeenCalled();
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

  it('rejects with the iOS-only message when Apple Health is unavailable (Android)', async () => {
    mockAppleHealthAvailable = false;
    await expect(saveWorkout(SESSION, [])).rejects.toThrow('Apple Health is only available on iOS.');
    expect(mockSaveCyclingWorkout).not.toHaveBeenCalled();
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
describe('saveWorkout pause history', () => {
  const PAUSE_AT_MS = SESSION.startedAtMs + 600_000;
  const RESUME_AT_MS = SESSION.startedAtMs + 1_800_000;
  const PAUSED_SESSION: PersistedTrainingSession = {
    ...SESSION,
    // Ten active minutes, twenty paused, ten more active: 30 minutes of wall
    // clock for 20 minutes of effort.
    endedAtMs: SESSION.startedAtMs + 2_400_000,
    elapsedSeconds: 1200,
    pauseEvents: [
      { kind: 'pause', atMs: PAUSE_AT_MS },
      { kind: 'resume', atMs: RESUME_AT_MS },
    ],
  };

  beforeEach(() => {
    mockSaveCyclingWorkout.mockResolvedValue('workout-uuid-paused');
  });

  it('forwards the ride pause and resume events so HealthKit can exclude the paused interval', async () => {
    await saveWorkout(PAUSED_SESSION, []);

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload.workoutEvents).toEqual([
      { type: 'pause', timestampMs: PAUSE_AT_MS },
      { type: 'resume', timestampMs: RESUME_AT_MS },
    ]);
  });

  it('keeps the trailing pause of a ride that was finished while paused', async () => {
    await saveWorkout(
      {
        ...PAUSED_SESSION,
        endedAtMs: RESUME_AT_MS,
        elapsedSeconds: 600,
        pauseEvents: [{ kind: 'pause', atMs: PAUSE_AT_MS }],
      },
      [],
    );

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload.workoutEvents).toEqual([{ type: 'pause', timestampMs: PAUSE_AT_MS }]);
  });

  it('sends no events for a ride recorded without a pause', async () => {
    await saveWorkout({ ...SESSION, pauseEvents: [] }, []);

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload.workoutEvents).toEqual([]);
  });

  it('sends no events for a ride whose pause history predates event capture', async () => {
    await saveWorkout({ ...SESSION, pauseEvents: null }, []);

    const payload = mockSaveCyclingWorkout.mock.calls[0][0];
    expect(payload.workoutEvents).toEqual([]);
  });
});

describe('profile reads', () => {
  it('reads biological sex through the local module without the legacy bridge', async () => {
    mockGetBiologicalSex.mockResolvedValueOnce('female');
    await expect(getBiologicalSex()).resolves.toBe('female');
  });

  it('getBiologicalSex returns male or female and null for unsupported or denied values', async () => {
    mockGetBiologicalSex.mockResolvedValueOnce('male');
    expect(await getBiologicalSex()).toBe('male');
    mockGetBiologicalSex.mockResolvedValueOnce('female');
    expect(await getBiologicalSex()).toBe('female');
    mockGetBiologicalSex.mockResolvedValueOnce('other');
    expect(await getBiologicalSex()).toBeNull();
    mockGetBiologicalSex.mockResolvedValueOnce(null);
    expect(await getBiologicalSex()).toBeNull();
    mockGetBiologicalSex.mockRejectedValueOnce(new Error('denied'));
    expect(await getBiologicalSex()).toBeNull();
  });

  it('getDateOfBirth keeps the date portion and returns null for absent or denied values', async () => {
    mockGetDateOfBirth.mockResolvedValueOnce('1985-03-10T00:00:00.000Z');
    expect(await getDateOfBirth()).toBe('1985-03-10');
    mockGetDateOfBirth.mockResolvedValueOnce(null);
    expect(await getDateOfBirth()).toBeNull();
    mockGetDateOfBirth.mockResolvedValueOnce('');
    expect(await getDateOfBirth()).toBeNull();
    mockGetDateOfBirth.mockRejectedValueOnce(new Error('denied'));
    expect(await getDateOfBirth()).toBeNull();
  });

  it('getLatestWeightKg returns positive finite kilograms and null otherwise', async () => {
    mockGetLatestWeight.mockResolvedValueOnce(80.5);
    expect(await getLatestWeightKg()).toBe(80.5);
    mockGetLatestWeight.mockResolvedValueOnce(0);
    expect(await getLatestWeightKg()).toBeNull();
    mockGetLatestWeight.mockResolvedValueOnce(Number.NaN);
    expect(await getLatestWeightKg()).toBeNull();
    mockGetLatestWeight.mockRejectedValueOnce(new Error('no sample'));
    expect(await getLatestWeightKg()).toBeNull();
  });

  it('getLatestHeightCm returns positive finite centimeters and null otherwise', async () => {
    mockGetLatestHeight.mockResolvedValueOnce(178);
    expect(await getLatestHeightCm()).toBe(178);
    mockGetLatestHeight.mockResolvedValueOnce(0);
    expect(await getLatestHeightCm()).toBeNull();
    mockGetLatestHeight.mockResolvedValueOnce(Number.POSITIVE_INFINITY);
    expect(await getLatestHeightCm()).toBeNull();
    mockGetLatestHeight.mockRejectedValueOnce(new Error('no sample'));
    expect(await getLatestHeightCm()).toBeNull();
  });

  it('loadProfileFromAppleHealth aggregates only the populated fields', async () => {
    mockGetBiologicalSex.mockResolvedValue('male');
    mockGetDateOfBirth.mockResolvedValue('1985-03-10');
    mockGetLatestWeight.mockResolvedValue(80);
    mockGetLatestHeight.mockRejectedValue(new Error('no sample'));

    const partial = await loadProfileFromAppleHealth();
    expect(partial).toEqual({ sex: 'male', dateOfBirth: '1985-03-10', weightKg: 80 });
  });

  it('loadProfileFromAppleHealth waits for authorization to finish before reading characteristics', async () => {
    let authorize: (() => void) | undefined;
    mockRequestAuth.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          authorize = resolve;
        }),
    );
    mockGetBiologicalSex.mockResolvedValue('female');
    mockGetDateOfBirth.mockResolvedValue('1990-01-01');
    mockGetLatestWeight.mockResolvedValue(60);
    mockGetLatestHeight.mockResolvedValue(165);

    const loading = loadProfileFromAppleHealth();
    expect(mockGetBiologicalSex).not.toHaveBeenCalled();
    authorize?.();

    await expect(loading).resolves.toEqual({ sex: 'female', dateOfBirth: '1990-01-01', weightKg: 60, heightCm: 165 });
  });

  it('initWithWritePermissions memoizes a single in-flight prompt across concurrent callers', async () => {
    mockRequestAuth.mockImplementationOnce(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    mockGetBiologicalSex.mockResolvedValue('male');
    mockGetDateOfBirth.mockResolvedValue('1985-03-10');
    mockGetLatestWeight.mockResolvedValue(80);
    mockGetLatestHeight.mockResolvedValue(180);

    await Promise.all([initWithWritePermissions(), loadProfileFromAppleHealth(), initWithWritePermissions()]);
    expect(mockRequestAuth).toHaveBeenCalledTimes(1);
  });
});
