import { renderHook, act, waitFor } from '@testing-library/react-native';
import { PermissionsAndroid } from 'react-native';
import type * as ReactNative from 'react-native';

import { useBlePermission } from '../useBlePermission';
import { bleManager } from '../../../../services/ble/bleClient';

jest.mock('../../../../services/ble/bleClient', () => ({
  bleManager: {
    state: jest.fn(),
  },
}));

// PermissionsAndroid.requestMultiple is undefined in the iOS jest env by
// default; stub it so Android-path tests can spy on it.
const mockRequestMultiple = jest.fn();
(PermissionsAndroid as unknown as Record<string, unknown>).requestMultiple = mockRequestMultiple;

describe('useBlePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with status unknown', () => {
      const { result } = renderHook(() => useBlePermission());
      expect(result.current.status).toBe('unknown');
    });
  });

  describe('requestBlePermission', () => {
    it('returns granted and updates status when Bluetooth is PoweredOn', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('granted');
      });

      expect(returnValue).toBe('granted');
    });

    it('returns granted and updates status when Bluetooth is PoweredOff (hardware present, permission allowed)', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOff');

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('granted');
      });

      expect(returnValue).toBe('granted');
    });

    it('returns denied and updates status when Bluetooth is Unauthorized', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('Unauthorized');

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('denied');
      });

      expect(returnValue).toBe('denied');
    });

    it('returns denied and updates status when Bluetooth is Unsupported', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('Unsupported');

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('denied');
      });

      expect(returnValue).toBe('denied');
    });

    it('returns denied and logs when bleManager.state throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (bleManager.state as jest.Mock).mockRejectedValue(new Error('BLE unavailable'));

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('denied');
      });

      expect(returnValue).toBe('denied');
      expect(consoleSpy).toHaveBeenCalledWith('[useBlePermission] Bluetooth state check failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('transitions status from unknown → granted → denied across multiple calls', async () => {
      (bleManager.state as jest.Mock).mockResolvedValueOnce('PoweredOn').mockResolvedValueOnce('Unauthorized');

      const { result } = renderHook(() => useBlePermission());

      expect(result.current.status).toBe('unknown');

      act(() => {
        void result.current.requestBlePermission();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('granted');
      });

      act(() => {
        void result.current.requestBlePermission();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('denied');
      });
    });
  });

  describe('Android runtime permissions', () => {
    const { Platform } = jest.requireActual<typeof ReactNative>('react-native');

    // Save originals so we can restore after each test
    let originalOS: string;
    let originalVersion: number | string;

    beforeEach(() => {
      originalOS = Platform.OS;
      originalVersion = Platform.Version;
    });

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true, writable: true });
      Object.defineProperty(Platform, 'Version', { value: originalVersion, configurable: true, writable: true });
    });

    function setAndroidPlatform(apiLevel: number) {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true, writable: true });
      Object.defineProperty(Platform, 'Version', { value: apiLevel, configurable: true, writable: true });
    }

    it('API 31+: requests BLUETOOTH_SCAN + BLUETOOTH_CONNECT; all granted → returns granted and consults bleManager.state', async () => {
      setAndroidPlatform(31);

      mockRequestMultiple.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
      });
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('granted');
      });

      expect(returnValue).toBe('granted');
      expect(mockRequestMultiple).toHaveBeenCalledWith([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      expect(bleManager.state).toHaveBeenCalled();
    });

    it('API 31+: a permission denied → returns denied without calling bleManager.state', async () => {
      setAndroidPlatform(31);

      mockRequestMultiple.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
      });

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('denied');
      });

      expect(returnValue).toBe('denied');
      expect(mockRequestMultiple).toHaveBeenCalledWith([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      expect(bleManager.state).not.toHaveBeenCalled();
    });

    it('API < 31 (e.g. 30): requests ACCESS_FINE_LOCATION; granted → returns granted', async () => {
      setAndroidPlatform(30);

      mockRequestMultiple.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
      });
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('granted');
      });

      expect(returnValue).toBe('granted');
      expect(mockRequestMultiple).toHaveBeenCalledWith([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
      expect(bleManager.state).toHaveBeenCalled();
    });

    it('iOS: does NOT call PermissionsAndroid.requestMultiple and still maps bleManager.state', async () => {
      // Platform.OS stays 'ios' (default in jest react-native preset)
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('granted');
      });

      expect(returnValue).toBe('granted');
      expect(mockRequestMultiple).not.toHaveBeenCalled();
      expect(bleManager.state).toHaveBeenCalled();
    });

    it('Android: requestMultiple throws → returns denied and logs error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      setAndroidPlatform(31);

      mockRequestMultiple.mockRejectedValue(new Error('permissions unavailable'));

      const { result } = renderHook(() => useBlePermission());

      let returnValue: string | undefined;
      act(() => {
        void result.current.requestBlePermission().then((v) => {
          returnValue = v;
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('denied');
      });

      expect(returnValue).toBe('denied');
      expect(bleManager.state).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[useBlePermission]'), expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});
