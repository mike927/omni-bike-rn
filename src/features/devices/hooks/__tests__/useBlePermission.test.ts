import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useBlePermission } from '../useBlePermission';
import { bleManager } from '../../../../services/ble/bleClient';

jest.mock('../../../../services/ble/bleClient', () => ({
  bleManager: {
    state: jest.fn(),
  },
}));

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
});
