import { WatchConnectivity } from 'watch-connectivity';
import type { HrAdapter } from '../ble/HrAdapter';

const CMD_STOP_HR = 'stopHr';

/**
 * HrAdapter implementation for Apple Watch HR streaming via WatchConnectivity.
 *
 * Unlike BLE adapters, this has no device ID — the Watch is always the user's
 * paired Apple Watch. connect() activates the WCSession and asks HealthKit on
 * the iPhone to launch/wake the Watch companion app for an indoor cycling
 * workout. HR samples arrive as WC messages and are forwarded to subscribers at
 * ~1 Hz.
 */
export class WatchHrAdapter implements HrAdapter {
  async connect(): Promise<void> {
    await WatchConnectivity.activate();
    await WatchConnectivity.startWatchApp();
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
