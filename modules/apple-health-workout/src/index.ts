import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

export interface HeartRateSampleInput {
  /** Beats per minute (positive). Samples with bpm <= 0 or outside [startDate, endDate] are dropped. */
  bpm: number;
  /** Unix epoch milliseconds. */
  timestampMs: number;
}

export interface CyclingQuantitySampleInput {
  /**
   * Sample value in the metric's canonical unit:
   * - cyclingPowerSamples: watts (W)
   * - cyclingCadenceSamples: revolutions per minute (count/min)
   * - cyclingSpeedSamples: meters per second (m/s)
   *
   * Negative / non-finite values and samples outside [startDate, endDate] are dropped.
   */
  value: number;
  /** Unix epoch milliseconds. */
  timestampMs: number;
}

/**
 * A pause or resume of the effort, at a moment inside the workout's window.
 *
 * HealthKit's own mechanism for a workout that was not one continuous effort:
 * `HKWorkoutBuilder` excludes the span between a `pause` and the next `resume`
 * from the workout's duration. A `pause` with no `resume` after it is a workout
 * that ended while paused.
 */
export interface WorkoutEventInput {
  type: 'pause' | 'resume';
  /** Unix epoch milliseconds. Events outside [startDate, endDate] are dropped. */
  timestampMs: number;
}

export interface SaveCyclingWorkoutOptions {
  /** ISO-8601 start date */
  startDate: string;
  /** ISO-8601 end date */
  endDate: string;
  /** Active energy in kilocalories — becomes the workout's `activeEnergyBurned` sample. */
  activeEnergyKcal: number;
  /** Basal (resting) energy in kilocalories; pass 0 when unavailable (fallback: Apple Fitness renders Active = Total). */
  basalEnergyKcal: number;
  /** Total distance in meters */
  totalDistanceMeters: number;
  /** Per-sample heart-rate trace attached to the workout */
  heartRateSamples: HeartRateSampleInput[];
  /** Per-sample cycling power trace in watts */
  cyclingPowerSamples: CyclingQuantitySampleInput[];
  /** Per-sample cycling cadence trace in RPM */
  cyclingCadenceSamples: CyclingQuantitySampleInput[];
  /** Per-sample cycling speed trace in meters/second */
  cyclingSpeedSamples: CyclingQuantitySampleInput[];
  /**
   * Ordered pause/resume events for the workout. Pass `[]` for a continuous
   * effort; the workout's duration then spans the whole window.
   */
  workoutEvents: WorkoutEventInput[];
}

declare class AppleHealthWorkoutNativeModule extends NativeModule {
  /**
   * Requests HealthKit authorization for every read + write type the app uses
   * — Workout, active/basal energy, cycling distance, heart rate, the iOS 17+
   * cycling metrics (`cyclingPower`/`cyclingCadence`/`cyclingSpeed`), and the
   * read-only profile characteristics — in a single authorization sheet.
   * Presenting one sheet (rather than this plus `react-native-health`'s
   * `initHealthKit`) avoids the iOS conflict where a second authorization
   * sheet requested mid-dismissal of the first never completes. Idempotent.
   */
  requestHealthKitAuthorization(): Promise<void>;

  /**
   * Sums HealthKit `basalEnergyBurned` samples over `[startDate, endDate]`,
   * excluding samples this app itself wrote — so a re-export of the same
   * workout interval doesn't read back its own previous basal write and
   * compound the Total calorie count on each retry.
   */
  queryBasalEnergyKcal(options: { startDate: string; endDate: string }): Promise<number>;

  /**
   * Saves an indoor-cycling HKWorkout via `HKWorkoutBuilder` with
   * `HKMetadataKeyIndoorWorkout=true`, cumulative active-energy + distance
   * samples, per-metric sample traces (HR + power + cadence + speed), and the
   * workout's pause/resume events, which is what makes HealthKit report the
   * ride's active duration rather than its wall-clock span.
   * Returns the saved workout's UUID string.
   */
  saveCyclingWorkout(options: SaveCyclingWorkoutOptions): Promise<string>;
}

const appleHealthWorkoutModule = requireOptionalNativeModule<AppleHealthWorkoutNativeModule>('AppleHealthWorkout');

/** True when the AppleHealthWorkout native module is linked (iOS). */
export const isAppleHealthWorkoutAvailable: boolean = appleHealthWorkoutModule !== null;

/**
 * The AppleHealthWorkout native module. Typed non-null for iOS-only callers in
 * appleHealthAdapter, which only run behind Apple-Health UI/provider gating.
 * Null at runtime on Android — never dereference without checking
 * `isAppleHealthWorkoutAvailable`.
 */
export const AppleHealthWorkout = appleHealthWorkoutModule as AppleHealthWorkoutNativeModule;
