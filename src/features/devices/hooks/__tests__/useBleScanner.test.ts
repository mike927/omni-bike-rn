import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useBleScanner } from '../useBleScanner';
import { bleManager } from '../../../../services/ble/bleClient';

jest.mock('../../../../services/ble/bleClient', () => ({
  bleManager: {
    state: jest.fn(),
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
  },
}));

describe('useBleScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scanForDevices', () => {
    it('should set an error if Bluetooth is not powered on', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOff');

      const { result } = renderHook(() => useBleScanner());

      act(() => {
        result.current.scanForDevices();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Bluetooth is not powered on (Current state: PoweredOff)');
      });

      expect(result.current.isScanning).toBe(false);
      expect(bleManager.startDeviceScan).not.toHaveBeenCalled();
    });

    it('should start scanning and update state if Bluetooth is on', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');

      const { result } = renderHook(() => useBleScanner());

      act(() => {
        result.current.scanForDevices();
      });

      await waitFor(() => {
        expect(result.current.isScanning).toBe(true);
      });

      expect(result.current.error).toBeNull();
      expect(bleManager.startDeviceScan).toHaveBeenCalled();
    });

    it('should handle scan errors correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');
      (bleManager.startDeviceScan as jest.Mock).mockImplementation((_uuids, _options, listener) => {
        listener(new Error('Scan failed'), null);
      });

      const { result } = renderHook(() => useBleScanner());

      act(() => {
        result.current.scanForDevices();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Scan failed');
      });

      expect(result.current.isScanning).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should add discovered devices to the list', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');
      const mockDevice = { id: 'device-1', name: 'Test Device' };

      (bleManager.startDeviceScan as jest.Mock).mockImplementation((_uuids, _options, listener) => {
        listener(null, mockDevice);
      });

      const { result } = renderHook(() => useBleScanner());

      act(() => {
        result.current.scanForDevices();
      });

      await waitFor(() => {
        expect(result.current.devices).toEqual([mockDevice]);
      });
    });

    it('admits a nameless device when it passes the client filter', async () => {
      // Regression guard: an earlier revision gated admission on `device.name`
      // truthiness, which silently dropped broadcast-capable Garmin/Polar
      // watches whose advertisement packet had not yet parsed a local name
      // but did carry a wearable vendor Company ID in manufacturerData. The
      // whole point of client-side filtering on scanFilters.ts is to accept
      // those candidates, so the scan callback must not re-introduce the
      // name gate. The UI renders 'Unknown Device' as a fallback label.
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');
      const namelessCandidate = { id: 'nameless-1', name: null };
      (bleManager.startDeviceScan as jest.Mock).mockImplementation((_uuids, _options, listener) => {
        listener(null, namelessCandidate);
      });
      const clientFilter = jest.fn().mockReturnValue(true);

      const { result } = renderHook(() => useBleScanner(null, clientFilter));

      act(() => {
        result.current.scanForDevices();
      });

      await waitFor(() => {
        expect(result.current.devices).toEqual([namelessCandidate]);
      });
      expect(clientFilter).toHaveBeenCalledWith(namelessCandidate);
    });

    it('drops a nameless device when the client filter rejects it', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');
      const namelessNoise = { id: 'noise-1', name: null };
      (bleManager.startDeviceScan as jest.Mock).mockImplementation((_uuids, _options, listener) => {
        listener(null, namelessNoise);
      });
      const clientFilter = jest.fn().mockReturnValue(false);

      const { result } = renderHook(() => useBleScanner(null, clientFilter));

      act(() => {
        result.current.scanForDevices();
      });

      // Give the filter a tick to run.
      await waitFor(() => {
        expect(clientFilter).toHaveBeenCalledWith(namelessNoise);
      });
      expect(result.current.devices).toEqual([]);
    });

    it('should not add duplicate devices to the list', async () => {
      (bleManager.state as jest.Mock).mockResolvedValue('PoweredOn');
      const mockDevice = { id: 'device-1', name: 'Test Device' };

      (bleManager.startDeviceScan as jest.Mock).mockImplementation((_uuids, _options, listener) => {
        listener(null, mockDevice);
        listener(null, mockDevice); // duplicate
      });

      const { result } = renderHook(() => useBleScanner());

      act(() => {
        result.current.scanForDevices();
      });

      await waitFor(() => {
        expect(result.current.devices).toEqual([mockDevice]); // Should only have one entry
      });
    });
  });

  describe('stopScanning', () => {
    it('should stop the scan and update state', () => {
      const { result } = renderHook(() => useBleScanner());

      act(() => {
        result.current.stopScanning();
      });

      expect(bleManager.stopDeviceScan).toHaveBeenCalled();
      expect(result.current.isScanning).toBe(false);
    });
  });
});
