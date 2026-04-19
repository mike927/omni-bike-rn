import { NativeModules } from 'react-native';
import type { HealthKitPermissions, HealthStatusResult } from 'react-native-health';

import { AppleHealthWorkout, type CyclingQuantitySampleInput, type HeartRateSampleInput } from 'apple-health-workout';
import {
  appendAppleHealthDiagnostic,
  getAppleHealthDiagnosticsRelativePath,
} from '../diagnostics/appleHealthDiagnostics';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';

interface BasalEnergyQueryOptions {
  startDate: string;
  endDate: string;
}

interface BasalEnergySample {
  value: number;
}

interface HealthKitNativeModule {
  initHealthKit: (permissions: HealthKitPermissions, callback: (error: HealthKitErrorLike) => void) => void;
  getAuthStatus: (
    permissions: HealthKitPermissions,
    callback: (error: HealthKitErrorLike, result: HealthStatusResult) => void,
  ) => void;
  getBasalEnergyBurned: (
    options: BasalEnergyQueryOptions,
    callback: (error: HealthKitErrorLike, results: BasalEnergySample[]) => void,
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
type HealthPermissionName = 'Workout' | 'ActiveEnergyBurned' | 'DistanceCycling' | 'HeartRate' | 'BasalEnergyBurned';
const HEALTH_PERMISSION_WORKOUT: HealthPermissionName = 'Workout';
const HEALTH_PERMISSION_ACTIVE_ENERGY_BURNED: HealthPermissionName = 'ActiveEnergyBurned';
const HEALTH_PERMISSION_DISTANCE_CYCLING: HealthPermissionName = 'DistanceCycling';
const HEALTH_PERMISSION_HEART_RATE: HealthPermissionName = 'HeartRate';
const HEALTH_PERMISSION_BASAL_ENERGY_BURNED: HealthPermissionName = 'BasalEnergyBurned';
const HEALTHKIT_STATUS_LABELS = ['NotDetermined', 'SharingDenied', 'SharingAuthorized'] as const;
const HEALTHKIT_WRITE_PERMISSIONS: readonly HealthPermissionName[] = [
  HEALTH_PERMISSION_WORKOUT,
  HEALTH_PERMISSION_ACTIVE_ENERGY_BURNED,
  HEALTH_PERMISSION_DISTANCE_CYCLING,
  HEALTH_PERMISSION_HEART_RATE,
];
// Read permissions: basal energy is queried post-session so the Apple Health
// upload can split the workout's calorie total into Active + Total samples.
const HEALTHKIT_READ_PERMISSIONS: readonly HealthPermissionName[] = [HEALTH_PERMISSION_BASAL_ENERGY_BURNED];

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

export async function initWithWritePermissions(): Promise<void> {
  const healthKit = getHealthKit();
  await initBaseWritePermissions(healthKit);
  await initCyclingMetricPermissions();
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
 * Sums HealthKit `basalEnergyBurned` samples over the workout interval so the
 * Apple Health upload can attach a Basal cumulative sample alongside Active.
 * Returns 0 when the library reports an error or no samples — the native
 * module then skips emitting the Basal sample and Apple Fitness renders
 * Active = Total, matching pre-split behavior.
 */
function queryBasalEnergyKcal(startedAtMs: number, endedAtMs: number): Promise<number> {
  return new Promise((resolve) => {
    let healthKit: HealthKitNativeModule;
    try {
      healthKit = getHealthKit();
    } catch (error: unknown) {
      appendAppleHealthDiagnostic('basalEnergy-query-module-unavailable', { error });
      resolve(0);
      return;
    }

    const options: BasalEnergyQueryOptions = {
      startDate: new Date(startedAtMs).toISOString(),
      endDate: new Date(endedAtMs).toISOString(),
    };

    healthKit.getBasalEnergyBurned(options, (error, results) => {
      if (error) {
        appendAppleHealthDiagnostic('basalEnergy-query-error', { error, options });
        resolve(0);
        return;
      }
      const totalKcal = Array.isArray(results)
        ? results.reduce((sum, sample) => {
            const value = sample?.value;
            return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum;
          }, 0)
        : 0;
      appendAppleHealthDiagnostic('basalEnergy-query-success', {
        options,
        sampleCount: Array.isArray(results) ? results.length : 0,
        totalKcal,
      });
      resolve(totalKcal);
    });
  });
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
  const basalEnergyKcal = await queryBasalEnergyKcal(session.startedAtMs, endDateMs);

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
