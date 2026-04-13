import { isStravaConnected, getConnectedAthlete } from '../../services/strava/stravaAuthService';
import { useStravaConnectionStore } from '../stravaConnectionStore';

jest.mock('../../services/strava/stravaAuthService', () => ({
  isStravaConnected: jest.fn(),
  getConnectedAthlete: jest.fn(),
}));

const mockIsStravaConnected = isStravaConnected as jest.Mock;
const mockGetConnectedAthlete = getConnectedAthlete as jest.Mock;

const SAMPLE_ATHLETE = { id: 1, firstName: 'Jane', lastName: 'Rider' };

beforeEach(() => {
  jest.clearAllMocks();
  useStravaConnectionStore.setState({ connected: false, athlete: null, hydrated: false });
});

describe('stravaConnectionStore', () => {
  describe('hydrate', () => {
    it('sets connected and athlete when tokens exist', async () => {
      mockIsStravaConnected.mockResolvedValue(true);
      mockGetConnectedAthlete.mockResolvedValue(SAMPLE_ATHLETE);

      await useStravaConnectionStore.getState().hydrate();

      const state = useStravaConnectionStore.getState();
      expect(state.connected).toBe(true);
      expect(state.athlete).toEqual(SAMPLE_ATHLETE);
      expect(state.hydrated).toBe(true);
    });

    it('sets disconnected when no tokens exist', async () => {
      mockIsStravaConnected.mockResolvedValue(false);

      await useStravaConnectionStore.getState().hydrate();

      const state = useStravaConnectionStore.getState();
      expect(state.connected).toBe(false);
      expect(state.athlete).toBeNull();
      expect(state.hydrated).toBe(true);
    });

    it('does not re-hydrate if already hydrated', async () => {
      useStravaConnectionStore.setState({ hydrated: true });

      await useStravaConnectionStore.getState().hydrate();

      expect(mockIsStravaConnected).not.toHaveBeenCalled();
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
