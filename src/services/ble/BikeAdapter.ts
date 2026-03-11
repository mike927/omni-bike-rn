import type { Subscription } from 'react-native-ble-plx';

export interface BikeMetrics {
  power?: number;
  cadence?: number;
  speed?: number;
  distance?: number;
  time?: number;
  calories?: number;
  hr?: number;
}

export interface BikeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToMetrics(callback: (metrics: BikeMetrics) => void): Subscription;
}
