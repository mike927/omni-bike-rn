import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useAppInitialization } from '../useAppInitialization';
import { initializeDatabase } from '../../services/db/migrations';
import { registerExportProviders } from '../../services/export/registerExportProviders';
import { useSavedGearStore } from '../../store/savedGearStore';
import { useAppPreferencesStore } from '../../store/appPreferencesStore';
import { useProviderGearLinkStore } from '../../store/providerGearLinkStore';
import { useStravaConnectionStore } from '../../store/stravaConnectionStore';
import { useAppleHealthConnectionStore } from '../../store/appleHealthConnectionStore';
import { useUserProfileStore } from '../../store/userProfileStore';

jest.mock('../../services/db/migrations', () => ({ initializeDatabase: jest.fn() }));
jest.mock('../../services/export/registerExportProviders', () => ({ registerExportProviders: jest.fn() }));
jest.mock('../../store/savedGearStore', () => ({ useSavedGearStore: jest.fn() }));
jest.mock('../../store/appPreferencesStore', () => ({ useAppPreferencesStore: jest.fn() }));
jest.mock('../../store/providerGearLinkStore', () => ({ useProviderGearLinkStore: jest.fn() }));
jest.mock('../../store/stravaConnectionStore', () => ({ useStravaConnectionStore: jest.fn() }));
jest.mock('../../store/appleHealthConnectionStore', () => ({ useAppleHealthConnectionStore: jest.fn() }));
jest.mock('../../store/userProfileStore', () => ({ useUserProfileStore: jest.fn() }));
jest.mock('../../features/gear/hooks/useWatchHr', () => ({ useWatchHr: jest.fn() }));
jest.mock('../../features/integrations/hooks/useAppleHealthPermissionsRefresh', () => ({
  useAppleHealthPermissionsRefresh: jest.fn(),
}));
jest.mock('../../features/training/hooks/useKeepAwakeDuringTraining', () => ({
  useKeepAwakeDuringTraining: jest.fn(),
}));
jest.mock('../../features/training/hooks/useTrainingSessionPersistence', () => ({
  useTrainingSessionPersistence: jest.fn(),
}));
jest.mock('../../features/training/hooks/useInterruptedSessionRecovery', () => ({
  useInterruptedSessionRecovery: jest.fn(),
}));

const mockInit = initializeDatabase as jest.Mock;

function mockStore(store: unknown, state: Record<string, unknown>) {
  (store as jest.Mock).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => selector(state));
}

function setAllHydrated(onboardingCompleted = false) {
  mockStore(useSavedGearStore, { hydrate: jest.fn().mockResolvedValue(undefined) });
  mockStore(useAppPreferencesStore, {
    hydrate: jest.fn().mockResolvedValue(undefined),
    hydrated: true,
    onboardingCompleted,
  });
  mockStore(useProviderGearLinkStore, { hydrate: jest.fn().mockResolvedValue(undefined), hydrated: true });
  mockStore(useStravaConnectionStore, { hydrate: jest.fn().mockResolvedValue(undefined), hydrated: true });
  mockStore(useAppleHealthConnectionStore, { hydrate: jest.fn().mockResolvedValue(undefined), hydrated: true });
  mockStore(useUserProfileStore, { hydrate: jest.fn().mockResolvedValue(undefined), hydrated: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setAllHydrated();
});

describe('useAppInitialization', () => {
  it('registers providers and hydrates the stores on mount', async () => {
    mockInit.mockResolvedValue(undefined);
    renderHook(() => useAppInitialization());
    await waitFor(() => expect(registerExportProviders).toHaveBeenCalled());
  });

  it('reports ready once the database initializes and all stores are hydrated', async () => {
    mockInit.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current).toEqual({ phase: 'ready', onboardingCompleted: false });
  });

  it('passes through onboardingCompleted', async () => {
    mockInit.mockResolvedValue(undefined);
    setAllHydrated(true);
    const { result } = renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current).toEqual({ phase: 'ready', onboardingCompleted: true });
  });

  it('stays loading while a store is not yet hydrated', async () => {
    mockInit.mockResolvedValue(undefined);
    mockStore(useUserProfileStore, { hydrate: jest.fn().mockResolvedValue(undefined), hydrated: false });
    const { result } = renderHook(() => useAppInitialization());
    await waitFor(() => expect(registerExportProviders).toHaveBeenCalled());
    expect(result.current.phase).toBe('loading');
  });

  it('reports error and retry re-runs database init when init fails', async () => {
    mockInit.mockRejectedValueOnce(new Error('db boom')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('error'));
    const errorState = result.current;
    if (errorState.phase !== 'error') throw new Error('expected error phase');
    await act(() => errorState.retry());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(mockInit).toHaveBeenCalledTimes(2);
  });
});
