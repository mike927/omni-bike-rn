import { useDeviceConnectionStore } from '../deviceConnectionStore';
import type { BikeAdapter, BikeMetrics } from '../../services/ble/BikeAdapter';
import type { HrAdapter } from '../../services/ble/HrAdapter';

describe('deviceConnectionStore', () => {
  beforeEach(() => {
    useDeviceConnectionStore.getState().clearAll();
  });

  const mockBikeAdapter: BikeAdapter = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeToMetrics: jest.fn().mockReturnValue({ remove: jest.fn() }),
    setControlState: jest.fn().mockResolvedValue(undefined),
  };

  const mockHrAdapter: HrAdapter = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribeToHeartRate: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };

  const sampleMetrics: BikeMetrics = {
    speed: 25,
    cadence: 80,
    power: 150,
    distance: 1000,
    resistance: 8,
    heartRate: 72,
  };

  describe('adapter management', () => {
    it('should start with null adapters', () => {
      const state = useDeviceConnectionStore.getState();
      expect(state.bikeAdapter).toBeNull();
      expect(state.hrAdapter).toBeNull();
      expect(state.bikeConnectionInProgress).toBe(false);
      expect(state.hrConnectionInProgress).toBe(false);
    });

    it('should set bike adapter', () => {
      useDeviceConnectionStore.getState().setBikeAdapter(mockBikeAdapter);
      expect(useDeviceConnectionStore.getState().bikeAdapter).toBe(mockBikeAdapter);
    });

    it('should set HR adapter', () => {
      useDeviceConnectionStore.getState().setHrAdapter(mockHrAdapter);
      expect(useDeviceConnectionStore.getState().hrAdapter).toBe(mockHrAdapter);
    });

    it('should clear adapter by setting null', () => {
      useDeviceConnectionStore.getState().setBikeAdapter(mockBikeAdapter);
      useDeviceConnectionStore.getState().setBikeAdapter(null);
      expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
    });

    it('should track connection progress flags', () => {
      useDeviceConnectionStore.getState().setBikeConnectionInProgress(true);
      useDeviceConnectionStore.getState().setHrConnectionInProgress(true);

      expect(useDeviceConnectionStore.getState().bikeConnectionInProgress).toBe(true);
      expect(useDeviceConnectionStore.getState().hrConnectionInProgress).toBe(true);
    });
  });

  describe('metric updates', () => {
    it('should start with null metrics', () => {
      const state = useDeviceConnectionStore.getState();
      expect(state.latestBikeMetrics).toBeNull();
      expect(state.latestBluetoothHr).toBeNull();
      expect(state.latestAppleWatchHr).toBeNull();
    });

    it('should update bike metrics', () => {
      useDeviceConnectionStore.getState().updateBikeMetrics(sampleMetrics);
      expect(useDeviceConnectionStore.getState().latestBikeMetrics).toEqual(sampleMetrics);
    });

    it('should update Bluetooth HR value', () => {
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      expect(useDeviceConnectionStore.getState().latestBluetoothHr).toBe(145);
    });

    it('should update Apple Watch HR value', () => {
      useDeviceConnectionStore.getState().updateAppleWatchHr(151);
      expect(useDeviceConnectionStore.getState().latestAppleWatchHr).toBe(151);
    });

    it('should overwrite previous metrics on update', () => {
      useDeviceConnectionStore.getState().updateBikeMetrics(sampleMetrics);
      const newMetrics: BikeMetrics = { speed: 30, cadence: 90, power: 200 };
      useDeviceConnectionStore.getState().updateBikeMetrics(newMetrics);
      expect(useDeviceConnectionStore.getState().latestBikeMetrics).toEqual(newMetrics);
    });
  });

  describe('clearAll()', () => {
    it('should reset everything to null', () => {
      useDeviceConnectionStore.getState().setBikeAdapter(mockBikeAdapter);
      useDeviceConnectionStore.getState().setHrAdapter(mockHrAdapter);
      useDeviceConnectionStore.getState().updateBikeMetrics(sampleMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      useDeviceConnectionStore.getState().updateAppleWatchHr(151);

      useDeviceConnectionStore.getState().clearAll();

      const state = useDeviceConnectionStore.getState();
      expect(state.bikeAdapter).toBeNull();
      expect(state.hrAdapter).toBeNull();
      expect(state.bikeConnectionInProgress).toBe(false);
      expect(state.hrConnectionInProgress).toBe(false);
      expect(state.latestBikeMetrics).toBeNull();
      expect(state.latestBluetoothHr).toBeNull();
      expect(state.latestAppleWatchHr).toBeNull();
    });

    it('should clear only the bike connection state', () => {
      useDeviceConnectionStore.getState().setBikeAdapter(mockBikeAdapter);
      useDeviceConnectionStore.getState().setHrAdapter(mockHrAdapter);
      useDeviceConnectionStore.getState().updateBikeMetrics(sampleMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      useDeviceConnectionStore.getState().updateAppleWatchHr(151);

      useDeviceConnectionStore.getState().clearBikeConnection();

      const state = useDeviceConnectionStore.getState();
      expect(state.bikeAdapter).toBeNull();
      expect(state.latestBikeMetrics).toBeNull();
      expect(state.hrAdapter).toBe(mockHrAdapter);
      expect(state.latestBluetoothHr).toBe(145);
      expect(state.latestAppleWatchHr).toBe(151);
    });

    it('should clear only the HR connection state', () => {
      useDeviceConnectionStore.getState().setBikeAdapter(mockBikeAdapter);
      useDeviceConnectionStore.getState().setHrAdapter(mockHrAdapter);
      useDeviceConnectionStore.getState().updateBikeMetrics(sampleMetrics);
      useDeviceConnectionStore.getState().updateBluetoothHr(145);
      useDeviceConnectionStore.getState().updateAppleWatchHr(151);

      useDeviceConnectionStore.getState().clearHrConnection();

      const state = useDeviceConnectionStore.getState();
      expect(state.hrAdapter).toBeNull();
      expect(state.latestBluetoothHr).toBeNull();
      expect(state.latestAppleWatchHr).toBe(151);
      expect(state.bikeAdapter).toBe(mockBikeAdapter);
      expect(state.latestBikeMetrics).toEqual(sampleMetrics);
    });
  });
});
