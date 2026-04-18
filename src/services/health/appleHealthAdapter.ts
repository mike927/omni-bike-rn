import AppleHealthKit, { type HealthKitPermissions } from 'react-native-health';

import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';

// react-native-health's runtime JS only exports the `HealthKit` object (with
// `Constants` attached). Its .d.ts additionally declares `HealthPermission` /
// `HealthActivity` / `HealthUnit` as enums, but they do not exist at runtime —
// importing them directly yields `undefined`. We read the real values off
// `AppleHealthKit.Constants.*` and keep typings strictly local.
interface HealthKitConstants {
  Activities: { Cycling: string };
  Permissions: {
    Workout: string;
    HeartRate: string;
    ActiveEnergyBurned: string;
    DistanceCycling: string;
  };
  Units: {
    bpm: string;
    kilocalorie: string;
    meter: string;
  };
}

interface SaveWorkoutOptions {
  type: string;
  startDate: string;
  endDate: string;
  energyBurned?: number;
  energyBurnedUnit?: string;
  distance?: number;
  distanceUnit?: string;
}

interface SaveHeartRateSampleOptions {
  value: number;
  date: string;
  unit?: string;
}

interface HealthKitNativeModule {
  Constants: HealthKitConstants;
  initHealthKit: (permissions: HealthKitPermissions, callback: (error: string) => void) => void;
  saveWorkout: (options: SaveWorkoutOptions, callback: (error: string, result: string) => void) => void;
  saveHeartRateSample: (options: SaveHeartRateSampleOptions, callback: (error: string) => void) => void;
}

const healthKit = AppleHealthKit as unknown as HealthKitNativeModule;
const { Activities, Permissions, Units } = healthKit.Constants;

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [],
    write: [
      Permissions.Workout,
      Permissions.HeartRate,
      Permissions.ActiveEnergyBurned,
      Permissions.DistanceCycling,
      // react-native-health typings model write[] as HealthPermission[] (an enum),
      // but the real values are plain strings from Constants.Permissions.
    ] as unknown as HealthKitPermissions['permissions']['write'],
  },
};

export async function initWithWritePermissions(): Promise<void> {
  return new Promise((resolve, reject) => {
    healthKit.initHealthKit(PERMISSIONS, (error: string) => {
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

export interface SaveWorkoutResult {
  workoutId: string;
  attemptedHrSampleCount: number;
  failedHrSampleCount: number;
}

export async function saveWorkout(
  session: PersistedTrainingSession,
  samples: PersistedTrainingSample[],
): Promise<SaveWorkoutResult> {
  const startDate = new Date(session.startedAtMs).toISOString();
  const endDateMs = session.endedAtMs ?? session.startedAtMs + session.elapsedSeconds * 1000;
  const endDate = new Date(endDateMs).toISOString();

  const workoutId = await new Promise<string>((resolve, reject) => {
    healthKit.saveWorkout(
      {
        type: Activities.Cycling,
        startDate,
        endDate,
        energyBurned: session.totalCaloriesKcal,
        energyBurnedUnit: Units.kilocalorie,
        distance: session.totalDistanceMeters,
        distanceUnit: Units.meter,
      },
      (error: string, result: string) => {
        if (error) {
          reject(new Error(error));
          return;
        }
        resolve(result);
      },
    );
  });

  // HR samples are best-effort telemetry attached to an already-persisted
  // HKWorkout. Rejecting the whole promise on HR failure would leave an orphan
  // workout in Health and cause a duplicate on retry — instead, count failures
  // and surface them as a warning higher up.
  let attemptedHrSampleCount = 0;
  let failedHrSampleCount = 0;

  for (const sample of samples) {
    const bpm = sample.metrics.heartRate;
    if (bpm === null || bpm <= 0) {
      continue;
    }
    attemptedHrSampleCount += 1;
    try {
      await new Promise<void>((resolve, reject) => {
        healthKit.saveHeartRateSample(
          {
            value: bpm,
            date: new Date(sample.recordedAtMs).toISOString(),
            unit: Units.bpm,
          },
          (error: string) => {
            if (error) {
              reject(new Error(error));
              return;
            }
            resolve();
          },
        );
      });
    } catch (error: unknown) {
      failedHrSampleCount += 1;
      console.error('[appleHealthAdapter] Failed to save heart rate sample:', error);
    }
  }

  return { workoutId, attemptedHrSampleCount, failedHrSampleCount };
}
