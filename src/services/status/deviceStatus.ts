import type { ReconnectState } from '../../types/gear';

/**
 * The single, app-wide vocabulary for how a device or HR source reports its
 * state on the read-only status surfaces (Home, Settings, Training dashboard).
 *
 * Exactly one label per state — every surface renders these via
 * `deviceStatusLabel`, so the same underlying condition always reads the same
 * word regardless of which device or screen shows it.
 */
export type DeviceStatus =
  | 'notSetUp' // no device saved / paired
  | 'connecting' // BLE connection attempt in flight
  | 'ready' // connected and working (idle, or streaming live mid-workout)
  | 'noSignal' // connected but no fresh data (mid-workout staleness)
  | 'paused' // active workout, source intentionally paused
  | 'unavailable' // configured but not reachable right now
  | 'off'; // exists but is not the selected/active source

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  notSetUp: 'Not set up',
  connecting: 'Connecting...',
  ready: 'Ready',
  noSignal: 'No signal',
  paused: 'Paused',
  unavailable: 'Unavailable',
  off: 'Off',
};

/** Single source of truth for the user-facing label of any device status. */
export function deviceStatusLabel(status: DeviceStatus): string {
  return DEVICE_STATUS_LABELS[status];
}

export interface BleDeviceStatusInput {
  /** Whether a device of this kind is saved (false → nothing to connect to). */
  readonly hasSavedDevice: boolean;
  /** Whether the live adapter is currently connected. */
  readonly connected: boolean;
  /** The auto-reconnect state-machine value. */
  readonly reconnect: ReconnectState;
}

/**
 * Connection status for a saved BLE device (the bike or a Bluetooth HR strap).
 *
 * Preserves the historical collapse from the old `reconnectLabel`: `idle`,
 * `disconnected`, and `failed` are not actionable on read-only surfaces, so they
 * all read `unavailable`. A live connection (`connected`) wins over any
 * reconnect value.
 */
export function bleDeviceStatus({ hasSavedDevice, connected, reconnect }: BleDeviceStatusInput): DeviceStatus {
  if (!hasSavedDevice) return 'notSetUp';
  if (connected) return 'ready';
  if (reconnect === 'connecting') return 'connecting';
  return 'unavailable';
}
