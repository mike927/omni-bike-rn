import type { Subscription } from 'react-native-ble-plx';

export interface BikeMetrics {
  speed: number; // km/h
  cadence: number; // RPM
  power: number; // Watts
  distance?: number; // Total distance in meters
  resistance?: number; // Resistance level (varies by machine)
  heartRate?: number; // BPM (if the bike has built-in sensors)
  status?: 'started' | 'paused' | 'stopped'; // Machine status events
}

export interface BikeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToMetrics(callback: (metrics: BikeMetrics) => void): Subscription;
}
