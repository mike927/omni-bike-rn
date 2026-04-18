import { loadAppleHealthConnected, setAppleHealthConnected } from '../../services/health/appleHealthConnectionStorage';
import { useAppleHealthConnectionStore } from '../appleHealthConnectionStore';

jest.mock('../../services/health/appleHealthConnectionStorage', () => ({
  loadAppleHealthConnected: jest.fn(),
  setAppleHealthConnected: jest.fn(),
}));

const mockLoad = loadAppleHealthConnected as jest.Mock;
const mockSet = setAppleHealthConnected as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useAppleHealthConnectionStore.setState({ connected: false, hydrated: false });
});

describe('appleHealthConnectionStore', () => {
  describe('hydrate', () => {
    it('sets connected from storage', async () => {
      mockLoad.mockResolvedValue(true);
      await useAppleHealthConnectionStore.getState().hydrate();
      const state = useAppleHealthConnectionStore.getState();
      expect(state.connected).toBe(true);
      expect(state.hydrated).toBe(true);
    });

    it('sets disconnected when storage returns false', async () => {
      mockLoad.mockResolvedValue(false);
      await useAppleHealthConnectionStore.getState().hydrate();
      const state = useAppleHealthConnectionStore.getState();
      expect(state.connected).toBe(false);
      expect(state.hydrated).toBe(true);
    });

    it('does not re-hydrate if already hydrated', async () => {
      useAppleHealthConnectionStore.setState({ hydrated: true });
      await useAppleHealthConnectionStore.getState().hydrate();
      expect(mockLoad).not.toHaveBeenCalled();
    });
  });

  describe('setConnected', () => {
    it('persists and updates state', async () => {
      mockSet.mockResolvedValue(undefined);
      await useAppleHealthConnectionStore.getState().setConnected();
      expect(mockSet).toHaveBeenCalledWith(true);
      expect(useAppleHealthConnectionStore.getState().connected).toBe(true);
    });
  });

  describe('setDisconnected', () => {
    it('persists and clears state', async () => {
      mockSet.mockResolvedValue(undefined);
      useAppleHealthConnectionStore.setState({ connected: true });
      await useAppleHealthConnectionStore.getState().setDisconnected();
      expect(mockSet).toHaveBeenCalledWith(false);
      expect(useAppleHealthConnectionStore.getState().connected).toBe(false);
    });
  });
});
