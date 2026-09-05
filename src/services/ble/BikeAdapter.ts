import type { Subscription } from 'react-native-ble-plx';
import type { BleConnectionOptions } from './BleConnectionOptions';

export enum BikeStatus {
  Started = 'started',
  Paused = 'paused',
  Stopped = 'stopped',
  Reset = 'reset',
}

export interface BikeMetrics {
  speed: number; // km/h
  cadence: number; // RPM
  /**
   * Instantaneous power in watts, absent when the machine did not report it.
   *
   * FTMS makes Instantaneous Power (flag bit 6) optional and independent of
   * Total Energy (bit 8), and `bleDeviceValidator` accepts an Indoor Bike Data
   * device without checking the power feature bit, so a supported machine can
   * stream energy and never a single watt. That absence must survive to the
   * calorie tiers: "no power reading" is not the same as a valid 0 W reading
   * from a coasting rider, and only the second one may drive the power tier.
   */
  power?: number;
  distance?: number; // Total distance in meters
  resistance?: number; // Resistance level (varies by machine)
  heartRate?: number; // BPM (if the bike has built-in sensors)
  totalEnergyKcal?: number; // FTMS cumulative energy in kcal
  energyPerHourKcal?: number; // FTMS energy rate per hour
  energyPerMinuteKcal?: number; // FTMS energy rate per minute
  status?: BikeStatus; // Machine status events
}

/**
 * How long the last bike notification stays usable as a live reading.
 *
 * A BLE stall does not always produce a disconnect event, so `latestBikeMetrics`
 * can sit in the store unchanged forever. Anything that integrates bike
 * telemetry over time (the calorie power tier) must bound it, or a dropout is
 * silently recorded as a rider holding steady wattage. Set above the slowest
 * FTMS notification cadence (bikes notify at roughly 1-4 Hz) and matched to the
 * lifecycle's stale-telemetry watchdog, so the engine releases the power tier at
 * the same moment the ride is judged to have gone silent.
 */
export const BIKE_SIGNAL_STALE_TIMEOUT_MS = 5_000;

export interface BikeAdapter {
  connect(options?: BleConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToMetrics(callback: (metrics: BikeMetrics) => void): Subscription;
  setControlState(status: BikeStatus): Promise<void>;
}
