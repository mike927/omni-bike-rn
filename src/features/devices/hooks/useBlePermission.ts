import { useState, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

import { bleManager } from '../../../services/ble/bleClient';

export type BlePermissionStatus = 'unknown' | 'granted' | 'denied';

interface UseBlePermissionReturn {
  status: BlePermissionStatus;
  requestBlePermission: () => Promise<BlePermissionStatus>;
}

/**
 * Requests Android runtime BLE permissions before scanning.
 *
 * - Android 12+ (API 31+): BLUETOOTH_SCAN + BLUETOOTH_CONNECT
 * - Android < 12: ACCESS_FINE_LOCATION (required for BLE scan on older OS)
 * - iOS / other: no-op, returns true immediately
 *
 * @returns true when all permissions are granted (or on non-Android), false otherwise.
 */
async function requestAndroidBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number.parseInt(Platform.Version, 10);

  const permissions =
    apiLevel >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const results = await PermissionsAndroid.requestMultiple(permissions);

  return permissions.every((p) => results[p] === PermissionsAndroid.RESULTS.GRANTED);
}

/**
 * Just-in-time Bluetooth permission hook.
 *
 * On iOS, CoreBluetooth shows the system permission dialog on the first
 * call to {@link bleManager.state}. This hook triggers that check and
 * returns a typed status so the UI can react before proceeding to scan.
 *
 * On Android 12+ (API 31+), runtime BLUETOOTH_SCAN and BLUETOOTH_CONNECT
 * permissions are requested first. On older Android, ACCESS_FINE_LOCATION
 * is requested instead. If any permission is denied the hook returns
 * `'denied'` immediately without consulting bleManager.
 *
 * - `'unknown'`  — not yet checked (initial state)
 * - `'granted'`  — hardware present and permission allowed
 * - `'denied'`   — user denied, or hardware unsupported
 */
export function useBlePermission(): UseBlePermissionReturn {
  const [status, setStatus] = useState<BlePermissionStatus>('unknown');

  const requestBlePermission = useCallback(async (): Promise<BlePermissionStatus> => {
    try {
      const androidGranted = await requestAndroidBlePermissions();
      if (!androidGranted) {
        setStatus('denied');
        return 'denied';
      }

      const state = await bleManager.state();

      if (state === 'Unauthorized' || state === 'Unsupported') {
        setStatus('denied');
        return 'denied';
      }

      setStatus('granted');
      return 'granted';
    } catch (err: unknown) {
      console.error('[useBlePermission] Bluetooth state check failed:', err);
      setStatus('denied');
      return 'denied';
    }
  }, []);

  return { status, requestBlePermission };
}
