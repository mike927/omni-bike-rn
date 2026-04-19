import { NativeModule, requireNativeModule } from 'expo-modules-core';

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
}

declare class AppleHealthWorkoutNativeModule extends NativeModule {
  /**
   * Requests HealthKit write authorization for the iOS 17+ cycling metric
   * types (`cyclingPower`, `cyclingCadence`, `cyclingSpeed`) that the
   * `react-native-health` bridge does not know about. Call once at app startup
   * alongside `AppleHealthKit.initHealthKit`. Idempotent.
   */
  requestCyclingMetricsAuthorization(): Promise<void>;

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
   * samples, and per-metric sample traces (HR + power + cadence + speed).
   * Returns the saved workout's UUID string.
   */
  saveCyclingWorkout(options: SaveCyclingWorkoutOptions): Promise<string>;
}

export const AppleHealthWorkout = requireNativeModule<AppleHealthWorkoutNativeModule>('AppleHealthWorkout');
