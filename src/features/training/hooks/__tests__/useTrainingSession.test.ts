import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useTrainingSession } from '../useTrainingSession';
import * as deviceConnectionModule from '../useDeviceConnection';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { BikeStatus } from '../../../../services/ble/BikeAdapter';
import { TrainingPhase } from '../../../../types/training';

const mockEngineStart = jest.fn();
const mockEngineStop = jest.fn();
const mockSetControlState = jest.fn();
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockHrDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../services/metronome/MetronomeEngine', () => ({
  MetronomeEngine: jest.fn().mockImplementation(() => ({
    start: mockEngineStart,
    stop: mockEngineStop,
    isRunning: jest.fn().mockReturnValue(false),
  })),
}));

describe('useTrainingSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDeviceConnectionStore.getState().clearAll();
    useTrainingSessionStore.setState({
      phase: TrainingPhase.Idle,
      elapsedSeconds: 0,
      totalDistance: 0,
      totalCalories: 0,
      initialDistance: null,
      currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    });
    useSavedGearStore.setState({
      savedBike: { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' },
      savedHrSource: { id: 'hr-uuid', name: 'Garmin HRM', type: 'hr' },
      hydrated: true,
      bikeReconnectState: 'connected',
      hrReconnectState: 'connected',
    });

    useDeviceConnectionStore.getState().setBikeAdapter({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: mockDisconnect,
      subscribeToMetrics: jest.fn(),
      setControlState: mockSetControlState,
    });

    useDeviceConnectionStore.getState().setHrAdapter({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: mockHrDisconnect,
      subscribeToHeartRate: jest.fn(),
    });
  });

  it('should not echo control writes when syncing a bike-started status', async () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      useDeviceConnectionStore.getState().updateBikeMetrics({
        speed: 25,
        cadence: 80,
        power: 150,
        status: BikeStatus.Started,
      });
    });

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Active);
    });

    expect(mockSetControlState).not.toHaveBeenCalled();
    expect(mockEngineStart).toHaveBeenCalledTimes(1);
  });

  it('should still send a control write for a user-initiated start', () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    expect(result.current.phase).toBe(TrainingPhase.Active);
    expect(mockSetControlState).toHaveBeenCalledWith(BikeStatus.Started);
    expect(mockEngineStart).toHaveBeenCalledTimes(1);
  });

  it('should not start a session when the bike is not connected', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useDeviceConnectionStore.getState().setBikeAdapter(null);

    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    expect(result.current.phase).toBe(TrainingPhase.Idle);
    expect(mockSetControlState).not.toHaveBeenCalled();
    expect(mockEngineStart).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[useTrainingSession] Cannot start session: bike not connected');

    warnSpy.mockRestore();
  });

  it('should stop the bike when finishing an active session', async () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    mockSetControlState.mockClear();
    mockEngineStop.mockClear();

    act(() => {
      result.current.finish();
    });

    await waitFor(() => {
      expect(mockSetControlState).toHaveBeenCalledWith(BikeStatus.Stopped);
    });

    expect(result.current.phase).toBe(TrainingPhase.Finished);
    expect(mockEngineStop).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().bikeAdapter).not.toBeNull();
    expect(useDeviceConnectionStore.getState().hrAdapter).not.toBeNull();
  });

  it('should not disconnect bike or HR when finishing an active session', async () => {
    let resolveStop!: () => void;
    const stopPromise = new Promise<void>((resolve) => {
      resolveStop = resolve;
    });
    mockSetControlState.mockReturnValueOnce(stopPromise);

    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    mockSetControlState.mockClear();
    mockDisconnect.mockClear();

    act(() => {
      result.current.finish();
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(mockHrDisconnect).not.toHaveBeenCalled();

    resolveStop();

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Finished);
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(mockHrDisconnect).not.toHaveBeenCalled();
    expect(useDeviceConnectionStore.getState().bikeAdapter).not.toBeNull();
  });

  it('should keep the bike adapter connected after finish so summary done can disconnect cleanly', async () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    mockSetControlState.mockClear();
    mockDisconnect.mockClear();
    mockHrDisconnect.mockClear();

    act(() => {
      result.current.finish();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Finished);
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(mockHrDisconnect).not.toHaveBeenCalled();
    expect(useDeviceConnectionStore.getState().bikeAdapter).not.toBeNull();
    expect(useDeviceConnectionStore.getState().hrAdapter).not.toBeNull();
  });

  it('should freeze (pause) the session when the bike reports Stopped while Active', async () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    act(() => {
      useDeviceConnectionStore.getState().updateBikeMetrics({
        speed: 0,
        cadence: 0,
        power: 0,
        status: BikeStatus.Stopped,
      });
    });

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Paused);
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('should ignore a bike Stopped echo when already Paused', async () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.phase).toBe(TrainingPhase.Paused);

    act(() => {
      useDeviceConnectionStore.getState().updateBikeMetrics({
        speed: 0,
        cadence: 0,
        power: 0,
        status: BikeStatus.Stopped,
      });
    });

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Paused);
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('should disconnect devices and reset session without sending bike reset command', async () => {
    const disconnectAllSpy = jest.spyOn(deviceConnectionModule, 'disconnectAllDeviceConnections');
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    mockSetControlState.mockClear();
    mockEngineStop.mockClear();

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Idle);
    });

    expect(mockEngineStop).toHaveBeenCalledTimes(1);
    expect(mockSetControlState).not.toHaveBeenCalledWith(BikeStatus.Reset);
    expect(disconnectAllSpy).toHaveBeenCalledWith({ updateReconnectState: true });
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockHrDisconnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
    expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');

    disconnectAllSpy.mockRestore();
  });

  it('should disconnect without bike reset when done is pressed from summary', async () => {
    const disconnectAllSpy = jest.spyOn(deviceConnectionModule, 'disconnectAllDeviceConnections');
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.finish();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Finished);
    });

    mockSetControlState.mockClear();
    mockDisconnect.mockClear();
    mockHrDisconnect.mockClear();

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe(TrainingPhase.Idle);
    });

    expect(mockSetControlState).not.toHaveBeenCalledWith(BikeStatus.Reset);
    expect(disconnectAllSpy).toHaveBeenCalledWith({ updateReconnectState: true });
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockHrDisconnect).toHaveBeenCalledTimes(1);
    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
    expect(useDeviceConnectionStore.getState().hrAdapter).toBeNull();
    expect(useDeviceConnectionStore.getState().latestBikeMetrics).toBeNull();
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('disconnected');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('disconnected');

    disconnectAllSpy.mockRestore();
  });

  it('should avoid issuing a bike reset command when already idle', () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe(TrainingPhase.Idle);
    expect(mockSetControlState).not.toHaveBeenCalled();
  });
});
