import { loadTokens } from '../../services/strava/stravaTokenStorage';
import { useStravaConnectionStore } from '../stravaConnectionStore';

jest.mock('../../services/strava/stravaTokenStorage', () => ({
  loadTokens: jest.fn(),
}));

const mockLoadTokens = loadTokens as jest.Mock;

const SAMPLE_ATHLETE = { id: 1, firstName: 'Jane', lastName: 'Rider' };
const SAMPLE_TOKENS = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 9999999999,
  athlete: SAMPLE_ATHLETE,
};

beforeEach(() => {
  jest.clearAllMocks();
  useStravaConnectionStore.setState({ connected: false, athlete: null, hydrated: false });
});

describe('stravaConnectionStore', () => {
  describe('hydrate', () => {
    it('sets connected and athlete when tokens exist', async () => {
      mockLoadTokens.mockResolvedValue(SAMPLE_TOKENS);

      await useStravaConnectionStore.getState().hydrate();

      const state = useStravaConnectionStore.getState();
      expect(state.connected).toBe(true);
      expect(state.athlete).toEqual(SAMPLE_ATHLETE);
      expect(state.hydrated).toBe(true);
    });

    it('sets disconnected when no tokens exist', async () => {
      mockLoadTokens.mockResolvedValue(null);

      await useStravaConnectionStore.getState().hydrate();

      const state = useStravaConnectionStore.getState();
      expect(state.connected).toBe(false);
      expect(state.athlete).toBeNull();
      expect(state.hydrated).toBe(true);
    });

    it('does not re-hydrate if already hydrated', async () => {
      useStravaConnectionStore.setState({ hydrated: true });

      await useStravaConnectionStore.getState().hydrate();

      expect(mockLoadTokens).not.toHaveBeenCalled();
    });
  });

  describe('setConnected', () => {
    it('updates connected state and athlete', () => {
      useStravaConnectionStore.getState().setConnected(SAMPLE_ATHLETE);

      const state = useStravaConnectionStore.getState();
      expect(state.connected).toBe(true);
      expect(state.athlete).toEqual(SAMPLE_ATHLETE);
    });
  });

  describe('setDisconnected', () => {
    it('clears connected state and athlete', () => {
      useStravaConnectionStore.setState({ connected: true, athlete: SAMPLE_ATHLETE });

      useStravaConnectionStore.getState().setDisconnected();

      const state = useStravaConnectionStore.getState();
      expect(state.connected).toBe(false);
      expect(state.athlete).toBeNull();
    });
  });
});
