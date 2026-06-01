import type { BleConnectionOptions } from './BleConnectionOptions';

export interface HrSubscription {
  remove(): void;
}

export interface HrAdapter {
  connect(options?: BleConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToHeartRate(callback: (hr: number) => void): HrSubscription;
  /**
   * Cumulative active-energy (kcal) stream for sources that report it (the
   * Apple Watch via its HKLiveWorkoutBuilder). Optional: BLE HR straps and the
   * bike's built-in pulse sensor don't provide calories, so they omit it.
   * Feeds the Watch-first tier of the calorie-source priority.
   */
  subscribeToActiveKcal?(callback: (kcal: number) => void): HrSubscription;
}
