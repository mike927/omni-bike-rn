import { NativeModules } from 'react-native';
import type { HealthKitPermissions, HealthStatusResult } from 'react-native-health';

import { AppleHealthWorkout, type HeartRateSampleInput } from 'apple-health-workout';
import {
  appendAppleHealthDiagnostic,
  getAppleHealthDiagnosticsRelativePath,
} from '../diagnostics/appleHealthDiagnostics';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';

interface HealthKitNativeModule {
  initHealthKit: (permissions: HealthKitPermissions, callback: (error: HealthKitErrorLike) => void) => void;
  getAuthStatus: (
    permissions: HealthKitPermissions,
    callback: (error: HealthKitErrorLike, result: HealthStatusResult) => void,
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
type HealthPermissionName = 'Workout' | 'ActiveEnergyBurned' | 'DistanceCycling' | 'HeartRate';
const HEALTH_PERMISSION_WORKOUT: HealthPermissionName = 'Workout';
const HEALTH_PERMISSION_ACTIVE_ENERGY_BURNED: HealthPermissionName = 'ActiveEnergyBurned';
const HEALTH_PERMISSION_DISTANCE_CYCLING: HealthPermissionName = 'DistanceCycling';
const HEALTH_PERMISSION_HEART_RATE: HealthPermissionName = 'HeartRate';
const HEALTHKIT_STATUS_LABELS = ['NotDetermined', 'SharingDenied', 'SharingAuthorized'] as const;
const HEALTHKIT_WRITE_PERMISSIONS: readonly HealthPermissionName[] = [
  HEALTH_PERMISSION_WORKOUT,
  HEALTH_PERMISSION_ACTIVE_ENERGY_BURNED,
  HEALTH_PERMISSION_DISTANCE_CYCLING,
  HEALTH_PERMISSION_HEART_RATE,
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
    read: [],
    write: HEALTHKIT_WRITE_PERMISSIONS as unknown as HealthKitPermissions['permissions']['write'],
  },
};

export async function initWithWritePermissions(): Promise<void> {
  return new Promise((resolve, reject) => {
    const healthKit = getHealthKit();
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

export interface SaveWorkoutResult {
  workoutId: string;
}

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

export async function saveWorkout(
  session: PersistedTrainingSession,
  samples: PersistedTrainingSample[],
): Promise<SaveWorkoutResult> {
  const startDate = new Date(session.startedAtMs).toISOString();
  const endDateMs = session.endedAtMs ?? session.startedAtMs + session.elapsedSeconds * 1000;
  const endDate = new Date(endDateMs).toISOString();
  const heartRateSamples = mapHeartRateSamples(samples);

  try {
    const workoutId = await AppleHealthWorkout.saveCyclingWorkout({
      startDate,
      endDate,
      totalEnergyKcal: session.totalCaloriesKcal,
      totalDistanceMeters: session.totalDistanceMeters,
      heartRateSamples,
    });
    appendAppleHealthDiagnostic('saveWorkout-success', {
      workoutId,
      startDate,
      endDate,
      calories: session.totalCaloriesKcal,
      distanceMeters: session.totalDistanceMeters,
      hrSampleCount: heartRateSamples.length,
    });
    return { workoutId };
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('saveWorkout-error', {
      error,
      startDate,
      endDate,
      calories: session.totalCaloriesKcal,
      distanceMeters: session.totalDistanceMeters,
      hrSampleCount: heartRateSamples.length,
    });
    throw normalizeHealthKitError(error, 'Failed to save Apple Health workout.');
  }
}
