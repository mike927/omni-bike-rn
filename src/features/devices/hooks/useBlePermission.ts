import { useState, useCallback } from 'react';

import { bleManager } from '../../../services/ble/bleClient';

export type BlePermissionStatus = 'unknown' | 'granted' | 'denied';

interface UseBlePermissionReturn {
  status: BlePermissionStatus;
  requestBlePermission: () => Promise<BlePermissionStatus>;
}

/**
 * Just-in-time Bluetooth permission hook.
 *
 * On iOS, CoreBluetooth shows the system permission dialog on the first
 * call to {@link bleManager.state}. This hook triggers that check and
 * returns a typed status so the UI can react before proceeding to scan.
 *
 * - `'unknown'`  — not yet checked (initial state)
 * - `'granted'`  — hardware present and permission allowed
 * - `'denied'`   — user denied, or hardware unsupported
 */
export function useBlePermission(): UseBlePermissionReturn {
  const [status, setStatus] = useState<BlePermissionStatus>('unknown');

  const requestBlePermission = useCallback(async (): Promise<BlePermissionStatus> => {
    try {
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
