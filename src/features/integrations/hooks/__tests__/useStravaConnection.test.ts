import { renderHook, act } from '@testing-library/react-native';

import { authorizeWithStrava, disconnectStrava } from '../../../../services/strava/stravaAuthService';
import { useStravaConnectionStore } from '../../../../store/stravaConnectionStore';
import { useStravaConnection } from '../useStravaConnection';

jest.mock('../../../../services/strava/stravaAuthService', () => ({
  authorizeWithStrava: jest.fn(),
  disconnectStrava: jest.fn(),
}));

jest.mock('../../../../store/stravaConnectionStore', () => {
  const store = {
    connected: false,
    athlete: null,
    setConnected: jest.fn(),
    setDisconnected: jest.fn(),
  };
  return {
    useStravaConnectionStore: jest.fn((selector: (s: typeof store) => unknown) => selector(store)),
  };
});

const mockAuthorize = authorizeWithStrava as jest.Mock;
const mockDisconnect = disconnectStrava as jest.Mock;
const mockUseStore = useStravaConnectionStore as unknown as jest.Mock;

const SAMPLE_TOKENS = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 9999999999,
  athlete: { id: 1, firstName: 'Jane', lastName: 'Rider' },
};

describe('useStravaConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStore.mockImplementation(
      (
        selector: (s: {
          connected: boolean;
          athlete: null;
          setConnected: jest.Mock;
          setDisconnected: jest.Mock;
        }) => unknown,
      ) => selector({ connected: false, athlete: null, setConnected: jest.fn(), setDisconnected: jest.fn() }),
    );
  });

  it('returns isConnected=false and null athleteName when disconnected', () => {
    const { result } = renderHook(() => useStravaConnection());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.athleteName).toBeNull();
  });

  it('returns isConnected=true and formatted athleteName when connected', () => {
    mockUseStore.mockImplementation(
      (
        selector: (s: {
          connected: boolean;
          athlete: { id: number; firstName: string; lastName: string };
          setConnected: jest.Mock;
          setDisconnected: jest.Mock;
        }) => unknown,
      ) =>
        selector({
          connected: true,
          athlete: SAMPLE_TOKENS.athlete,
          setConnected: jest.fn(),
          setDisconnected: jest.fn(),
        }),
    );
    const { result } = renderHook(() => useStravaConnection());
    expect(result.current.isConnected).toBe(true);
    expect(result.current.athleteName).toBe('Jane Rider');
  });

  describe('connect', () => {
    it('calls authorizeWithStrava and returns success', async () => {
      mockAuthorize.mockResolvedValue(SAMPLE_TOKENS);
      const { result } = renderHook(() => useStravaConnection());

      const outcome = await act(() => result.current.connect());

      expect(outcome.success).toBe(true);
      expect(mockAuthorize).toHaveBeenCalled();
    });

    it('returns failure when authorizeWithStrava throws', async () => {
      mockAuthorize.mockRejectedValue(new Error('Auth cancelled'));
      const { result } = renderHook(() => useStravaConnection());

      const outcome = await act(() => result.current.connect());

      expect(outcome.success).toBe(false);
      expect(outcome.errorMessage).toContain('Auth cancelled');
    });
  });

  describe('disconnect', () => {
    it('calls disconnectStrava and returns success', async () => {
      mockDisconnect.mockResolvedValue(undefined);
      const { result } = renderHook(() => useStravaConnection());

      const outcome = await act(() => result.current.disconnect());

      expect(outcome.success).toBe(true);
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('returns failure when disconnectStrava throws', async () => {
      mockDisconnect.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useStravaConnection());

      const outcome = await act(() => result.current.disconnect());

      expect(outcome.success).toBe(false);
      expect(outcome.errorMessage).toContain('Network error');
    });
  });
});
