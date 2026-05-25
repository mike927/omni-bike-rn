import { useHrSourceStore } from '../hrSourceStore';
import * as storage from '../../services/preferences/appPreferencesStorage';

jest.mock('../../services/preferences/appPreferencesStorage');

const mockLoad = storage.loadPrimaryHrSource as jest.Mock;
const mockSet = storage.setPrimaryHrSource as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useHrSourceStore.setState({ primary: null, hydrated: false });
  mockSet.mockResolvedValue(undefined);
});

describe('initial state', () => {
  it('starts with primary null and hydrated false', () => {
    const state = useHrSourceStore.getState();
    expect(state.primary).toBeNull();
    expect(state.hydrated).toBe(false);
  });
});

describe('hydrate', () => {
  it('loads from storage and marks hydrated', async () => {
    mockLoad.mockResolvedValue('watch');
    await useHrSourceStore.getState().hydrate();
    const state = useHrSourceStore.getState();
    expect(state.primary).toBe('watch');
    expect(state.hydrated).toBe(true);
  });

  it('sets primary to null when storage has no value', async () => {
    mockLoad.mockResolvedValue(null);
    await useHrSourceStore.getState().hydrate();
    const state = useHrSourceStore.getState();
    expect(state.primary).toBeNull();
    expect(state.hydrated).toBe(true);
  });

  it('does not reload when already hydrated', async () => {
    useHrSourceStore.setState({ hydrated: true });
    await useHrSourceStore.getState().hydrate();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('handles each source value correctly', async () => {
    for (const source of ['watch', 'bluetooth', 'bike'] as const) {
      mockLoad.mockResolvedValue(source);
      useHrSourceStore.setState({ primary: null, hydrated: false });
      await useHrSourceStore.getState().hydrate();
      expect(useHrSourceStore.getState().primary).toBe(source);
    }
  });
});

describe('setPrimary', () => {
  it('updates primary in state', async () => {
    await useHrSourceStore.getState().setPrimary('bluetooth');
    expect(useHrSourceStore.getState().primary).toBe('bluetooth');
  });

  it('persists the new source to storage', async () => {
    await useHrSourceStore.getState().setPrimary('bike');
    expect(mockSet).toHaveBeenCalledWith('bike');
  });

  it('updates state for each source value', async () => {
    for (const source of ['watch', 'bluetooth', 'bike'] as const) {
      await useHrSourceStore.getState().setPrimary(source);
      expect(useHrSourceStore.getState().primary).toBe(source);
      expect(mockSet).toHaveBeenLastCalledWith(source);
    }
  });
});
