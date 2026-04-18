import { NativeModule, requireNativeModule } from 'expo-modules-core';

export interface HeartRateSampleInput {
  /** Beats per minute (positive integer). Samples with bpm <= 0 are dropped by the native module. */
  bpm: number;
  /** Unix epoch milliseconds. Samples outside [startDate, endDate] are dropped by the native module. */
  timestampMs: number;
}

export interface SaveCyclingWorkoutOptions {
  /** ISO-8601 start date */
  startDate: string;
  /** ISO-8601 end date */
  endDate: string;
  /** Total active energy in kilocalories */
  totalEnergyKcal: number;
  /** Total distance in meters */
  totalDistanceMeters: number;
  /** Per-sample heart-rate trace attached to the workout */
  heartRateSamples: HeartRateSampleInput[];
}

declare class AppleHealthWorkoutNativeModule extends NativeModule {
  /**
   * Saves an indoor-cycling HKWorkout via `HKWorkoutBuilder` with
   * `HKMetadataKeyIndoorWorkout=true`, cumulative active energy + distance
   * samples, and the supplied per-sample heart-rate trace. Returns the saved
   * workout's UUID string.
   */
  saveCyclingWorkout(options: SaveCyclingWorkoutOptions): Promise<string>;
}

export const AppleHealthWorkout = requireNativeModule<AppleHealthWorkoutNativeModule>('AppleHealthWorkout');
