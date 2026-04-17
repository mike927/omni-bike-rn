import { WatchConnectivity } from 'watch-connectivity';
import type { HrAdapter } from '../ble/HrAdapter';

/**
 * HrAdapter implementation for Apple Watch HR streaming via WatchConnectivity.
 *
 * Unlike BLE adapters, this has no device ID — the Watch is always the user's
 * paired Apple Watch. connect() starts an iPhone-primary HKWorkoutSession and
 * mirrors it to the Watch, which foregrounds the companion app and begins HR
 * collection. disconnect() ends the primary session; the mirrored Watch session
 * transitions to `.ended` automatically. HR samples arrive from the Watch as WC
 * messages and are forwarded to subscribers at ~1 Hz.
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
}
