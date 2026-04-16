import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type WatchHrPayload = { hr: number };
export type WatchReachabilityPayload = { reachable: boolean };

type WatchConnectivityModuleEvents = {
  onWatchHr: (payload: WatchHrPayload) => void;
  onReachabilityChange: (payload: WatchReachabilityPayload) => void;
};

declare class WatchConnectivityNativeModule extends NativeModule<WatchConnectivityModuleEvents> {
  /** Returns true when the device supports WatchConnectivity (i.e. iPhone paired with Watch). */
  isSupported(): boolean;
  /** Activates the WCSession. Safe to call multiple times — no-op if already active. */
  activate(): Promise<void>;
  /** Sends a message dictionary to the paired Watch. No-op if Watch is not currently reachable. */
  sendMessage(message: Record<string, string | number>): void;
}

export const WatchConnectivity = requireNativeModule<WatchConnectivityNativeModule>('WatchConnectivity');
