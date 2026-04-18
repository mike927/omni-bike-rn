import { NativeModule, requireNativeModule } from 'expo-modules-core';

export interface SaveCyclingWorkoutOptions {
  /** ISO-8601 start date */
  startDate: string;
  /** ISO-8601 end date */
  endDate: string;
  /** Total active energy in kilocalories */
  totalEnergyKcal: number;
  /** Total distance in meters */
  totalDistanceMeters: number;
}

declare class AppleHealthWorkoutNativeModule extends NativeModule {
  /**
   * Saves an indoor-cycling HKWorkout with HKMetadataKeyIndoorWorkout=true,
   * totalEnergyBurned in kilocalories, and totalDistance in meters. Returns
   * the saved workout's UUID string.
   */
  saveCyclingWorkout(options: SaveCyclingWorkoutOptions): Promise<string>;
}

export const AppleHealthWorkout = requireNativeModule<AppleHealthWorkoutNativeModule>('AppleHealthWorkout');
