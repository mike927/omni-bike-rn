import { retryBikeConnection, retryHrConnection } from '../reconnectController';
import { useSavedGearStore } from '../../../store/savedGearStore';
import type { ReconnectState } from '../../../types/gear';

interface AutoReconnect {
  readonly bikeReconnectState: ReconnectState;
  readonly hrReconnectState: ReconnectState;
  /** Dial the saved bike now, lifting suppression and restoring the probe budget. */
  readonly retryBike: () => void;
  /** Dial the saved HR source now, lifting suppression and restoring the probe budget. */
  readonly retryHr: () => void;
}

/**
 * Screen-facing view of the auto-reconnect policy.
 *
 * Effect-free by design, like `useTrainingSession`: mounting it starts nothing
 * and unmounting it stops nothing. The retry budget, the probe timers and the
 * cycle they drive belong to `reconnectController`, reconciled by the root-owned
 * `useAutoReconnectLifecycle`, so any number of screens can read this at once
 * and one reconnect cycle behaves the same however the user is navigating.
 */
export function useAutoReconnect(): AutoReconnect {
  const bikeReconnectState = useSavedGearStore((s) => s.bikeReconnectState);
  const hrReconnectState = useSavedGearStore((s) => s.hrReconnectState);

  return {
    bikeReconnectState,
    hrReconnectState,
    retryBike: retryBikeConnection,
    retryHr: retryHrConnection,
  };
}
