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
  | 'unavailable' // configured but not reachable right now
  | 'off'; // exists but is not the selected/active source

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  notSetUp: 'Not set up',
  connecting: 'Connecting...',
  ready: 'Ready',
  noSignal: 'No signal',
  unavailable: 'Unavailable',
  off: 'Off',
};

/** Single source of truth for the user-facing label of any device status. */
export function deviceStatusLabel(status: DeviceStatus): string {
  return DEVICE_STATUS_LABELS[status];
}
