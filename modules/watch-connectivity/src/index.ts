import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type WatchHrPayload = { hr: number };
export type WatchActiveKcalPayload = { activeKcal: number };
export type WatchReachabilityPayload = {
  reachable: boolean;
  activationState?: number;
  paired?: boolean;
  installed?: boolean;
};
export type WatchSessionStatePayload = { state: 'started' | 'ended' | 'failed'; sentAtMs: number };
/** Stable presence of the companion: the Watch is paired and the app is installed. */
export type WatchCompanionStatePayload = {
  available: boolean;
  paired?: boolean;
  installed?: boolean;
  activationState?: number;
  reachable?: boolean;
};
export type WatchAppStatePayload = { state: string };
/** A ride-control request initiated on the Watch (the wrist acting as a remote). */
export type WatchControlAction = 'pause' | 'resume' | 'end';
export type WatchControlRequestPayload = { action: WatchControlAction };

type WatchConnectivityModuleEvents = {
  onWatchHr: (payload: WatchHrPayload) => void;
  onWatchActiveKcal: (payload: WatchActiveKcalPayload) => void;
  onReachabilityChange: (payload: WatchReachabilityPayload) => void;
  onWatchSessionState: (payload: WatchSessionStatePayload) => void;
  onWatchCompanionStateChange: (payload: WatchCompanionStatePayload) => void;
  onWatchAppState: (payload: WatchAppStatePayload) => void;
  /**
   * The Watch app requested a ride-control action (Pause / Resume / End) from the
   * wrist. The iPhone is the source of truth, so the handler runs the same training
   * actions a phone tap would — the existing iPhone→Watch command path then pauses /
   * ends the Watch's own HKWorkoutSession in turn.
   */
  onWatchControlRequest: (payload: WatchControlRequestPayload) => void;
};

declare class WatchConnectivityNativeModule extends NativeModule<WatchConnectivityModuleEvents> {
  /** Activates the WCSession. Safe to call multiple times — no-op if already active. */
  activate(): Promise<void>;
  /**
   * Wakes the paired Watch companion app and delivers an HKWorkoutConfiguration.
   * The Watch owns and starts the primary HKWorkoutSession; the iPhone receives
   * it via `workoutSessionMirroringStartHandler`.
   */
  startWatchApp(): Promise<void>;
  /**
   * Signals the paired Watch companion app to end its active workout session.
   * The Watch owns the HKWorkoutSession lifecycle; when unreachable the stop
   * command is queued for later delivery.
   */
  endMirroredWorkout(): Promise<void>;
  /**
   * Tells the paired Watch to pause its active workout session. The Watch owns the
   * HKWorkoutSession, so only it can pause — pausing stops its workout timer and HR
   * collection. Queued via transferUserInfo when the Watch is unreachable.
   */
  pauseMirroredWorkout(): Promise<void>;
  /** Tells the paired Watch to resume its paused workout session. */
  resumeMirroredWorkout(): Promise<void>;
}

export const WatchConnectivity = requireNativeModule<WatchConnectivityNativeModule>('WatchConnectivity');
