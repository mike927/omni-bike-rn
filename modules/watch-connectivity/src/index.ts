import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type WatchHrPayload = { hr: number };
export type WatchReachabilityPayload = { reachable: boolean };
export type WatchSessionStatePayload = { state: 'started' | 'ended' | 'failed'; sentAtMs: number };

type WatchConnectivityModuleEvents = {
  onWatchHr: (payload: WatchHrPayload) => void;
  onReachabilityChange: (payload: WatchReachabilityPayload) => void;
  onWatchSessionState: (payload: WatchSessionStatePayload) => void;
};

declare class WatchConnectivityNativeModule extends NativeModule<WatchConnectivityModuleEvents> {
  /** Activates the WCSession. Safe to call multiple times — no-op if already active. */
  activate(): Promise<void>;
  /** Launches or wakes the companion Watch app for an indoor cycling workout. */
  startWatchApp(): Promise<void>;
  /**
   * Sends a message dictionary to the paired Watch. Returns `true` if the message was
   * delivered to the WC layer, `false` if the session was not activated or the Watch
   * was not currently reachable.
   */
  sendMessage(message: Record<string, string | number>): boolean;
}

export const WatchConnectivity = requireNativeModule<WatchConnectivityNativeModule>('WatchConnectivity');
