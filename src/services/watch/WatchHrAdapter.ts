import { WatchConnectivity } from 'watch-connectivity';
import type { HrAdapter } from '../ble/HrAdapter';

const CMD_START_HR = 'startHr';
const CMD_STOP_HR = 'stopHr';

/**
 * HrAdapter implementation for Apple Watch HR streaming via WatchConnectivity.
 *
 * Unlike BLE adapters, this has no device ID — the Watch is always the user's
 * paired Apple Watch. connect() activates the WCSession and asks HealthKit on
 * the iPhone to launch/wake the Watch companion app for an indoor cycling
 * workout. After launch, it also sends an explicit `startHr` WC message as a
 * fallback nudge for cases where the Watch app is already running or the
 * HealthKit handoff does not surface into the app delegate reliably. HR samples
 * arrive as WC messages and are forwarded to subscribers at ~1 Hz.
 */
export class WatchHrAdapter implements HrAdapter {
  async connect(): Promise<void> {
    await WatchConnectivity.activate();
    await WatchConnectivity.startWatchApp();
    const delivered = WatchConnectivity.sendMessage({ cmd: CMD_START_HR });
    if (!delivered) {
      console.warn('[WatchHrAdapter] startHr dropped — Watch unreachable after launch handoff');
    }
  }

  async disconnect(): Promise<void> {
    const delivered = WatchConnectivity.sendMessage({ cmd: CMD_STOP_HR });
    if (!delivered) {
      // Watch is unreachable at disconnect time — the Watch-side HKWorkoutSession
      // will remain active until the Watch app backgrounds itself. Surface this
      // so a dropped stop is visible in logs rather than silently ignored.
      console.warn('[WatchHrAdapter] stopHr dropped — Watch unreachable; Watch session may linger until backgrounded');
    }
  }

  subscribeToHeartRate(callback: (hr: number) => void): { remove: () => void } {
    const subscription = WatchConnectivity.addListener('onWatchHr', ({ hr }) => {
      callback(hr);
    });
    return subscription;
  }
}
