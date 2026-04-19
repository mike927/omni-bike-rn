import { renderHook, act } from '@testing-library/react-native';

import { initWithWritePermissions } from '../../../../services/health/appleHealthAdapter';
import { useAppleHealthConnectionStore } from '../../../../store/appleHealthConnectionStore';
import { useAppleHealthConnection } from '../useAppleHealthConnection';

jest.mock('../../../../services/health/appleHealthAdapter', () => ({
  initWithWritePermissions: jest.fn(),
}));

const mockSetConnected = jest.fn();
const mockSetDisconnected = jest.fn();

jest.mock('../../../../store/appleHealthConnectionStore', () => ({
  useAppleHealthConnectionStore: jest.fn(),
}));

const mockInit = initWithWritePermissions as jest.Mock;
const mockUseStore = useAppleHealthConnectionStore as unknown as jest.Mock;

type MockStoreState = {
  connected: boolean;
  setConnected: jest.Mock;
  setDisconnected: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseStore.mockImplementation((selector: (s: MockStoreState) => unknown) =>
    selector({
      connected: false,
      setConnected: mockSetConnected,
      setDisconnected: mockSetDisconnected,
    }),
  );
});

describe('useAppleHealthConnection', () => {
  it('returns isConnected from store', () => {
    mockUseStore.mockImplementation((selector: (s: MockStoreState) => unknown) =>
      selector({ connected: true, setConnected: mockSetConnected, setDisconnected: mockSetDisconnected }),
    );
    const { result } = renderHook(() => useAppleHealthConnection());
    expect(result.current.isConnected).toBe(true);
  });

  describe('connect', () => {
    it('calls initWithWritePermissions, flips store flag, and returns success', async () => {
      mockInit.mockResolvedValue(undefined);
      mockSetConnected.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAppleHealthConnection());

      const outcome = await act(() => result.current.connect());

      expect(outcome.success).toBe(true);
      expect(mockInit).toHaveBeenCalled();
      expect(mockSetConnected).toHaveBeenCalled();
    });

    it('returns failure when initWithWritePermissions throws', async () => {
      mockInit.mockRejectedValue(new Error('permission denied'));
      const { result } = renderHook(() => useAppleHealthConnection());

      const outcome = await act(() => result.current.connect());

      expect(outcome.success).toBe(false);
      expect(outcome.errorMessage).toContain('permission denied');
      expect(mockSetConnected).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('flips store flag and returns success', async () => {
      mockSetDisconnected.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAppleHealthConnection());

      const outcome = await act(() => result.current.disconnect());

      expect(outcome.success).toBe(true);
      expect(mockSetDisconnected).toHaveBeenCalled();
    });

    it('returns failure when setDisconnected throws', async () => {
      mockSetDisconnected.mockRejectedValue(new Error('storage error'));
      const { result } = renderHook(() => useAppleHealthConnection());

      const outcome = await act(() => result.current.disconnect());

      expect(outcome.success).toBe(false);
      expect(outcome.errorMessage).toContain('storage error');
    });
  });
});
