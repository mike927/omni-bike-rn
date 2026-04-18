import AppleHealthKit, {
  type HealthKitPermissions,
  HealthActivity,
  HealthPermission,
  HealthUnit,
} from 'react-native-health';

import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [],
    write: [
      HealthPermission.Workout,
      HealthPermission.HeartRate,
      HealthPermission.ActiveEnergyBurned,
      HealthPermission.DistanceCycling,
    ],
  },
};

// react-native-health's TS types for saveWorkout omit energyBurned/distance (the
// native bridge accepts them), and saveHeartRateSample uses `date` not
// startDate/endDate. Local extensions keep us off `as any`.
interface SaveWorkoutOptions {
  type: HealthActivity;
  startDate: string;
  endDate: string;
  energyBurned?: number;
  energyBurnedUnit?: HealthUnit;
  distance?: number;
  distanceUnit?: HealthUnit;
}

interface SaveHeartRateSampleOptions {
  value: number;
  date: string;
  unit?: HealthUnit;
}

interface HealthKitNativeModule {
  initHealthKit: (permissions: HealthKitPermissions, callback: (error: string) => void) => void;
  saveWorkout: (options: SaveWorkoutOptions, callback: (error: string, result: string) => void) => void;
  saveHeartRateSample: (options: SaveHeartRateSampleOptions, callback: (error: string) => void) => void;
}

const healthKit = AppleHealthKit as unknown as HealthKitNativeModule;

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
        type: HealthActivity.Cycling,
        startDate,
        endDate,
        energyBurned: session.totalCaloriesKcal,
        energyBurnedUnit: HealthUnit.kilocalorie,
        distance: session.totalDistanceMeters,
        distanceUnit: HealthUnit.meter,
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
            unit: HealthUnit.bpm,
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
