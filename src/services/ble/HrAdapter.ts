import type { Subscription } from 'react-native-ble-plx';

export interface HrAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToHeartRate(callback: (hr: number) => void): Subscription;
}
