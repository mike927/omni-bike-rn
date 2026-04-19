import { NativeModules } from 'react-native';
import type { HealthKitPermissions, HealthStatusResult } from 'react-native-health';

import { AppleHealthWorkout, type CyclingQuantitySampleInput, type HeartRateSampleInput } from 'apple-health-workout';
import {
  appendAppleHealthDiagnostic,
  getAppleHealthDiagnosticsRelativePath,
} from '../diagnostics/appleHealthDiagnostics';
import { basalKcalForWindow } from '../calories/mifflinStJeor';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';
import { toMifflinInputs, type BiologicalSex, type UserProfileField } from '../../types/userProfile';
import { useUserProfileStore } from '../../store/userProfileStore';

interface HealthValueResult {
  value: number | string | null;
}

interface HealthDateOfBirthResult {
  value: string | null;
  age: number | null;
}

interface HealthQuantityOptions {
  unit?: string;
}

interface HealthKitNativeModule {
  initHealthKit: (permissions: HealthKitPermissions, callback: (error: HealthKitErrorLike) => void) => void;
  getAuthStatus: (
    permissions: HealthKitPermissions,
    callback: (error: HealthKitErrorLike, result: HealthStatusResult) => void,
  ) => void;
  getBiologicalSex: (
    options: HealthQuantityOptions,
    callback: (error: HealthKitErrorLike, result: HealthValueResult) => void,
  ) => void;
  getDateOfBirth: (
    options: HealthQuantityOptions,
    callback: (error: HealthKitErrorLike, result: HealthDateOfBirthResult) => void,
  ) => void;
  getLatestWeight: (
    options: HealthQuantityOptions,
    callback: (error: HealthKitErrorLike, result: HealthValueResult) => void,
  ) => void;
  getLatestHeight: (
    options: HealthQuantityOptions,
    callback: (error: HealthKitErrorLike, result: HealthValueResult) => void,
  ) => void;
}

interface HealthKitErrorObject {
  message?: string;
  code?: number | string;
  domain?: string;
  userInfo?: Record<string, unknown>;
  nativeStackIOS?: string[];
}

type HealthKitErrorLike = HealthKitErrorObject | string | null | undefined;

// react-native-health typings model write[] as a `HealthPermission` enum, but
// the real native API accepts plain string literals. Use a local string-union
// type to avoid importing a mismatched enum while keeping the array typed.
type HealthPermissionName =
  | 'Workout'
  | 'ActiveEnergyBurned'
  | 'DistanceCycling'
  | 'HeartRate'
  | 'BasalEnergyBurned'
  | 'BiologicalSex'
  | 'DateOfBirth'
  | 'Weight'
  | 'Height';
const HEALTH_PERMISSION_WORKOUT: HealthPermissionName = 'Workout';
const HEALTH_PERMISSION_ACTIVE_ENERGY_BURNED: HealthPermissionName = 'ActiveEnergyBurned';
const HEALTH_PERMISSION_DISTANCE_CYCLING: HealthPermissionName = 'DistanceCycling';
const HEALTH_PERMISSION_HEART_RATE: HealthPermissionName = 'HeartRate';
const HEALTH_PERMISSION_BASAL_ENERGY_BURNED: HealthPermissionName = 'BasalEnergyBurned';
const HEALTH_PERMISSION_BIOLOGICAL_SEX: HealthPermissionName = 'BiologicalSex';
const HEALTH_PERMISSION_DATE_OF_BIRTH: HealthPermissionName = 'DateOfBirth';
const HEALTH_PERMISSION_WEIGHT: HealthPermissionName = 'Weight';
const HEALTH_PERMISSION_HEIGHT: HealthPermissionName = 'Height';
const HEALTHKIT_STATUS_LABELS = ['NotDetermined', 'SharingDenied', 'SharingAuthorized'] as const;
const HEALTHKIT_WRITE_PERMISSIONS: readonly HealthPermissionName[] = [
  HEALTH_PERMISSION_WORKOUT,
  HEALTH_PERMISSION_ACTIVE_ENERGY_BURNED,
  HEALTH_PERMISSION_DISTANCE_CYCLING,
  HEALTH_PERMISSION_HEART_RATE,
  // Part B attaches a basalEnergyBurned sample to each saved workout so Apple
  // Fitness can render the Active / Total split. Without the write permission
  // HealthKit rejects `builder.add(samples)` with "Not authorized".
  HEALTH_PERMISSION_BASAL_ENERGY_BURNED,
];
const HEALTHKIT_READ_PERMISSIONS: readonly HealthPermissionName[] = [
  HEALTH_PERMISSION_BASAL_ENERGY_BURNED,
  // Part C reads the user's biological sex, date of birth, latest weight, and
  // latest height to personalize the Keytel calorie formula and the Mifflin
  // basal fallback. All four are read-only; the user manages the source of
  // truth in the Apple Health app.
  HEALTH_PERMISSION_BIOLOGICAL_SEX,
  HEALTH_PERMISSION_DATE_OF_BIRTH,
  HEALTH_PERMISSION_WEIGHT,
  HEALTH_PERMISSION_HEIGHT,
];

function getHealthKit(): HealthKitNativeModule {
  const healthKit = NativeModules.AppleHealthKit as HealthKitNativeModule | undefined;

  if (!healthKit?.initHealthKit || !healthKit?.getAuthStatus) {
    throw new Error(
      'Apple Health native module is unavailable. Rebuild the iOS app with the native dependency installed.',
    );
  }

  return healthKit;
}

function formatHealthKitErrorMessage(error: HealthKitErrorLike, fallbackMessage: string): string {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallbackMessage;
  }
}

function normalizeHealthKitError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  const normalizedError = new Error(formatHealthKitErrorMessage(error as HealthKitErrorLike, fallbackMessage));

  if (error && typeof error === 'object') {
    Object.assign(normalizedError, { details: error });
  }

  return normalizedError;
}

function logHealthKitAuthorizationStatus(healthKit: HealthKitNativeModule, context: string): void {
  if (!__DEV__) {
    return;
  }

  healthKit.getAuthStatus(PERMISSIONS, (error: HealthKitErrorLike, result: HealthStatusResult) => {
    if (error) {
      appendAppleHealthDiagnostic('auth-status-read-failed', {
        context,
        error,
      });
      console.warn('[appleHealthAdapter] Failed to read HealthKit authorization status', {
        context,
        error,
      });
      return;
    }

    const writeStatuses = Object.fromEntries(
      HEALTHKIT_WRITE_PERMISSIONS.map((permission, index) => {
        const statusCode = result.permissions.write[index];
        const label =
          typeof statusCode === 'number'
            ? (HEALTHKIT_STATUS_LABELS[statusCode] ?? `Unknown(${statusCode})`)
            : 'Missing';
        return [permission, label];
      }),
    );

    appendAppleHealthDiagnostic('auth-status', {
      context,
      permissions: PERMISSIONS.permissions,
      writeStatuses,
      raw: result,
      diagnosticsFile: getAppleHealthDiagnosticsRelativePath(),
    });
    console.warn('[appleHealthAdapter] HealthKit authorization status', {
      context,
      permissions: PERMISSIONS.permissions,
      writeStatuses,
      raw: result,
    });
  });
}

// Single cast at the react-native-health interop boundary because upstream
// typings model `write[]` as a `HealthPermission` enum while the native API
// expects plain string literals — see `HealthPermissionName` above.
const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: HEALTHKIT_READ_PERMISSIONS as unknown as HealthKitPermissions['permissions']['read'],
    write: HEALTHKIT_WRITE_PERMISSIONS as unknown as HealthKitPermissions['permissions']['write'],
  },
};

function initBaseWritePermissions(healthKit: HealthKitNativeModule): Promise<void> {
  return new Promise((resolve, reject) => {
    appendAppleHealthDiagnostic('initHealthKit-permissions-payload', {
      permissions: PERMISSIONS.permissions,
      diagnosticsFile: getAppleHealthDiagnosticsRelativePath(),
    });
    if (__DEV__) {
      console.warn('[appleHealthAdapter] initHealthKit permissions payload', PERMISSIONS.permissions);
    }

    healthKit.initHealthKit(PERMISSIONS, (error: HealthKitErrorLike) => {
      if (error) {
        appendAppleHealthDiagnostic('initHealthKit-error', {
          error,
          permissions: PERMISSIONS.permissions,
        });
        reject(normalizeHealthKitError(error, 'Failed to initialize Apple Health permissions.'));
        return;
      }
      appendAppleHealthDiagnostic('initHealthKit-success', {
        permissions: PERMISSIONS.permissions,
      });
      logHealthKitAuthorizationStatus(healthKit, 'after-init');
      resolve();
    });
  });
}

// iOS 17+ cycling metric types (cyclingPower / cyclingCadence / cyclingSpeed)
// are not represented in `react-native-health`'s permission-string bridge, so
// our own native module requests their write authorization directly.
async function initCyclingMetricPermissions(): Promise<void> {
  try {
    await AppleHealthWorkout.requestCyclingMetricsAuthorization();
    appendAppleHealthDiagnostic('cyclingMetrics-auth-success', {});
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('cyclingMetrics-auth-error', { error });
    throw normalizeHealthKitError(error, 'Failed to authorize Apple Health cycling metrics.');
  }
}

// Memoize a single in-flight init promise so the launch-time permission
// refresh hook and the profile auto-sync hook can both await initialization
// without firing duplicate iOS authorization prompts. Cleared on failure so
// subsequent attempts can retry.
let initPromise: Promise<void> | null = null;

export async function initWithWritePermissions(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const healthKit = getHealthKit();
    await initBaseWritePermissions(healthKit);
    await initCyclingMetricPermissions();
  })().catch((error: unknown) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

// Test seam: reset the memoized init promise so each test starts from a
// known state.
export function __resetHealthKitInitPromiseForTests(): void {
  initPromise = null;
}

export interface SaveWorkoutResult {
  workoutId: string;
}

// km/h → m/s conversion factor for cyclingSpeed samples. HealthKit's canonical
// unit for `cyclingSpeed` is m/s; our bike ticks report speed in km/h.
const KMH_TO_MPS = 1 / 3.6;

function mapHeartRateSamples(samples: PersistedTrainingSample[]): HeartRateSampleInput[] {
  const mapped: HeartRateSampleInput[] = [];
  for (const sample of samples) {
    const bpm = sample.metrics.heartRate;
    if (typeof bpm === 'number' && bpm > 0) {
      mapped.push({ bpm, timestampMs: sample.recordedAtMs });
    }
  }
  return mapped;
}

function mapCyclingSamples(
  samples: PersistedTrainingSample[],
  extract: (metrics: PersistedTrainingSample['metrics']) => number,
): CyclingQuantitySampleInput[] {
  const mapped: CyclingQuantitySampleInput[] = [];
  for (const sample of samples) {
    const value = extract(sample.metrics);
    if (Number.isFinite(value) && value >= 0) {
      mapped.push({ value, timestampMs: sample.recordedAtMs });
    }
  }
  return mapped;
}

/**
 * Sums HealthKit `basalEnergyBurned` for the workout interval via the native
 * module, which filters out this app's own prior basal writes so a re-export
 * doesn't compound. Returns 0 on any failure — the native save then skips
 * emitting the Basal sample and Apple Fitness renders Active = Total, matching
 * pre-split behavior.
 */
async function queryBasalEnergyKcal(startedAtMs: number, endedAtMs: number): Promise<number> {
  const options = {
    startDate: new Date(startedAtMs).toISOString(),
    endDate: new Date(endedAtMs).toISOString(),
  };
  try {
    const kcal = await AppleHealthWorkout.queryBasalEnergyKcal(options);
    appendAppleHealthDiagnostic('basalEnergy-query-success', { options, totalKcal: kcal });
    return Number.isFinite(kcal) && kcal > 0 ? kcal : 0;
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('basalEnergy-query-error', { error, options });
    return 0;
  }
}

interface ResolveBasalArgs {
  queriedBasalKcal: number;
  durationSeconds: number;
}

/**
 * Picks the basal kcal value for the workout. HealthKit is the source of truth
 * when it returns a positive number; when it returns 0 (no samples for the
 * window) we fall back to a Mifflin–St Jeor estimate computed from the user
 * profile so Apple Fitness still renders a real Resting figure. With no
 * profile, we pass through 0 — Apple Fitness falls back to Active = Total,
 * which matches pre-fallback behaviour.
 */
function resolveBasalKcal({ queriedBasalKcal, durationSeconds }: ResolveBasalArgs): number {
  if (queriedBasalKcal > 0) return queriedBasalKcal;
  if (durationSeconds <= 0) return 0;
  const profile = useUserProfileStore.getState().profile;
  const mifflinInputs = toMifflinInputs(profile);
  if (mifflinInputs === null) return 0;
  const estimate = basalKcalForWindow(mifflinInputs, durationSeconds);
  appendAppleHealthDiagnostic('basalEnergy-mifflin-fallback', { estimate, durationSeconds });
  return estimate;
}

export async function saveWorkout(
  session: PersistedTrainingSession,
  samples: PersistedTrainingSample[],
): Promise<SaveWorkoutResult> {
  const startDate = new Date(session.startedAtMs).toISOString();
  const endDateMs = session.endedAtMs ?? session.startedAtMs + session.elapsedSeconds * 1000;
  const endDate = new Date(endDateMs).toISOString();
  const heartRateSamples = mapHeartRateSamples(samples);
  const cyclingPowerSamples = mapCyclingSamples(samples, (m) => m.power);
  const cyclingCadenceSamples = mapCyclingSamples(samples, (m) => m.cadence);
  const cyclingSpeedSamples = mapCyclingSamples(samples, (m) => m.speed * KMH_TO_MPS);
  const queriedBasalKcal = await queryBasalEnergyKcal(session.startedAtMs, endDateMs);
  const basalEnergyKcal = resolveBasalKcal({
    queriedBasalKcal,
    durationSeconds: Math.max(0, (endDateMs - session.startedAtMs) / 1000),
  });

  try {
    const workoutId = await AppleHealthWorkout.saveCyclingWorkout({
      startDate,
      endDate,
      activeEnergyKcal: session.totalCaloriesKcal,
      basalEnergyKcal,
      totalDistanceMeters: session.totalDistanceMeters,
      heartRateSamples,
      cyclingPowerSamples,
      cyclingCadenceSamples,
      cyclingSpeedSamples,
    });
    appendAppleHealthDiagnostic('saveWorkout-success', {
      workoutId,
      startDate,
      endDate,
      activeEnergyKcal: session.totalCaloriesKcal,
      basalEnergyKcal,
      distanceMeters: session.totalDistanceMeters,
      hrSampleCount: heartRateSamples.length,
      powerSampleCount: cyclingPowerSamples.length,
      cadenceSampleCount: cyclingCadenceSamples.length,
      speedSampleCount: cyclingSpeedSamples.length,
    });
    return { workoutId };
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('saveWorkout-error', {
      error,
      startDate,
      endDate,
      activeEnergyKcal: session.totalCaloriesKcal,
      basalEnergyKcal,
      distanceMeters: session.totalDistanceMeters,
      hrSampleCount: heartRateSamples.length,
      powerSampleCount: cyclingPowerSamples.length,
      cadenceSampleCount: cyclingCadenceSamples.length,
      speedSampleCount: cyclingSpeedSamples.length,
    });
    throw normalizeHealthKitError(error, 'Failed to save Apple Health workout.');
  }
}

export type AppleHealthProfilePartial = Partial<{
  [F in UserProfileField]: F extends 'sex' ? BiologicalSex : F extends 'dateOfBirth' ? string : number;
}>;

function callBridge<R>(invoke: (callback: (error: HealthKitErrorLike, result: R) => void) => void): Promise<R | null> {
  return new Promise((resolve) => {
    try {
      invoke((error, result) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(result ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

export async function getBiologicalSex(): Promise<BiologicalSex | null> {
  const healthKit = getHealthKit();
  const result = await callBridge<HealthValueResult>((cb) => healthKit.getBiologicalSex({}, cb));
  if (!result) return null;
  if (result.value === 'male' || result.value === 'female') return result.value;
  return null;
}

export async function getDateOfBirth(): Promise<string | null> {
  const healthKit = getHealthKit();
  const result = await callBridge<HealthDateOfBirthResult>((cb) => healthKit.getDateOfBirth({}, cb));
  const iso = result?.value;
  if (typeof iso !== 'string' || iso.length === 0) return null;
  // The native bridge returns a full ISO timestamp; profile storage canonicalizes
  // on the date portion (yyyy-mm-dd) so the value renders cleanly in UI inputs
  // and is stable across timezones.
  return iso.slice(0, 10);
}

export async function getLatestWeightKg(): Promise<number | null> {
  const healthKit = getHealthKit();
  const result = await callBridge<HealthValueResult>((cb) => healthKit.getLatestWeight({ unit: 'kg' }, cb));
  const value = result?.value;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export async function getLatestHeightCm(): Promise<number | null> {
  const healthKit = getHealthKit();
  const result = await callBridge<HealthValueResult>((cb) => healthKit.getLatestHeight({ unit: 'cm' }, cb));
  const value = result?.value;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export async function loadProfileFromAppleHealth(): Promise<AppleHealthProfilePartial> {
  // Block on init so the four characteristic-type reads don't run before iOS
  // has prompted for the new Sex / DOB / Weight / Height read permissions.
  // Without this, on app upgrade the auto-sync runs to completion before the
  // user has a chance to grant the new types and silently returns no fields.
  await initWithWritePermissions();
  const [sex, dateOfBirth, weightKg, heightCm] = await Promise.all([
    getBiologicalSex(),
    getDateOfBirth(),
    getLatestWeightKg(),
    getLatestHeightCm(),
  ]);
  const partial: AppleHealthProfilePartial = {};
  if (sex !== null) partial.sex = sex;
  if (dateOfBirth !== null) partial.dateOfBirth = dateOfBirth;
  if (weightKg !== null) partial.weightKg = weightKg;
  if (heightCm !== null) partial.heightCm = heightCm;
  return partial;
}
