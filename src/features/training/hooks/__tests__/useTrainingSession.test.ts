import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useTrainingSession } from '../useTrainingSession';
import { useDeviceConnectionStore } from '../../../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../../../store/trainingSessionStore';
import { BikeStatus } from '../../../../services/ble/BikeAdapter';
import { TrainingPhase } from '../../../../types/training';

const mockEngineStart = jest.fn();
const mockEngineStop = jest.fn();
const mockSetControlState = jest.fn();

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
      disconnect: jest.fn().mockResolvedValue(undefined),
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
});
