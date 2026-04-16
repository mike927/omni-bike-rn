import type { BleConnectionOptions } from './BleConnectionOptions';

export interface HrSubscription {
  remove(): void;
}

export interface HrAdapter {
  connect(options?: BleConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToHeartRate(callback: (hr: number) => void): HrSubscription;
}
