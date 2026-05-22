import type { ReconnectState } from '../../types/gear';

/**
 * Shared display label for a saved BLE device's live connection state.
 * "failed", "disconnected", and "idle" all collapse to "Disconnected" — the
 * distinction isn't actionable on the read-only status surfaces; recovery lives
 * in Settings / gear setup.
 */
export function reconnectLabel(state: ReconnectState): string {
  if (state === 'connecting') return 'Connecting...';
  if (state === 'connected') return 'Connected';
  return 'Disconnected';
}
