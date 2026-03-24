import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useTrainingSession } from '../useTrainingSession';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { BikeStatus } from '../../../../services/ble/BikeAdapter';
import { TrainingPhase } from '../../../../types/training';

const mockEngineStart = jest.fn();
const mockEngineStop = jest.fn();
const mockSetControlState = jest.fn();
const mockDisconnect = jest.fn();

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

    useDeviceConnectionStore.getState().setBikeAdapter({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: mockDisconnect,
      subscribeToMetrics: jest.fn(),
      setControlState: mockSetControlState,
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
  });

  it('should disconnect the bike after finishing an active session', async () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    mockSetControlState.mockClear();
    mockDisconnect.mockClear();

    act(() => {
      result.current.finish();
    });

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    expect(useDeviceConnectionStore.getState().bikeAdapter).toBeNull();
    expect(useDeviceConnectionStore.getState().latestBikeMetrics).toBeNull();
  });

  it('should reset local state and send a bike reset command for an active session', () => {
    const { result } = renderHook(() => useTrainingSession());

    act(() => {
      result.current.start();
    });

    mockSetControlState.mockClear();
    mockEngineStop.mockClear();

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe(TrainingPhase.Idle);
    expect(mockEngineStop).toHaveBeenCalledTimes(1);
    expect(mockSetControlState).toHaveBeenCalledWith(BikeStatus.Reset);
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
