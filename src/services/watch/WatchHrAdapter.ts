import { WatchConnectivity } from 'watch-connectivity';
import type { HrAdapter } from '../ble/HrAdapter';

const CMD_START_HR = 'startHr';
const CMD_STOP_HR = 'stopHr';

/**
 * HrAdapter implementation for Apple Watch HR streaming via WatchConnectivity.
 *
 * Unlike BLE adapters, this has no device ID — the Watch is always the user's
 * paired Apple Watch. connect() activates the WCSession and instructs the Watch
 * companion app to start an HKWorkoutSession. HR samples arrive as WC messages
 * and are forwarded to subscribers at ~1 Hz.
 */
export class WatchHrAdapter implements HrAdapter {
  async connect(): Promise<void> {
    await WatchConnectivity.activate();
    const delivered = WatchConnectivity.sendMessage({ cmd: CMD_START_HR });
    if (!delivered) {
      throw new Error('Apple Watch is not reachable');
    }
  }

  async disconnect(): Promise<void> {
    WatchConnectivity.sendMessage({ cmd: CMD_STOP_HR });
  }

  subscribeToHeartRate(callback: (hr: number) => void): { remove: () => void } {
    const subscription = WatchConnectivity.addListener('onWatchHr', ({ hr }) => {
      callback(hr);
    });
    return subscription;
  }
}
