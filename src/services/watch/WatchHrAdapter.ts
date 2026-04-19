import { WatchConnectivity } from 'watch-connectivity';
import type { HrAdapter } from '../ble/HrAdapter';

/**
 * HrAdapter implementation for Apple Watch HR streaming via WatchConnectivity.
 *
 * Unlike BLE adapters, this has no device ID — the Watch is always the user's
 * paired Apple Watch. connect() wakes the Watch companion app via
 * `startWatchApp`, after which the Watch creates the primary HKWorkoutSession
 * and mirrors it back to the iPhone. disconnect() signals the Watch to end its
 * session. HR samples arrive from the Watch as WC messages and are forwarded to
 * subscribers at ~1 Hz.
 */
export class WatchHrAdapter implements HrAdapter {
  async connect(): Promise<void> {
    await WatchConnectivity.activate();
    await WatchConnectivity.startWatchApp();
  }

  async disconnect(): Promise<void> {
    await WatchConnectivity.endMirroredWorkout();
  }

  subscribeToHeartRate(callback: (hr: number) => void): { remove: () => void } {
    const subscription = WatchConnectivity.addListener('onWatchHr', ({ hr }) => {
      callback(hr);
    });
    return subscription;
  }

  /**
   * Cumulative active-energy samples for the current Watch workout session.
   * Emitted at the same ~1 Hz cadence as HR and piggy-backed on the same WC
   * payload; subscribers receive the session-to-date kcal, not a per-tick delta.
   */
  subscribeToActiveKcal(callback: (kcal: number) => void): { remove: () => void } {
    const subscription = WatchConnectivity.addListener('onWatchActiveKcal', ({ activeKcal }) => {
      callback(activeKcal);
    });
    return subscription;
  }
}
