import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useAppInitialization } from '../useAppInitialization';
import { initializeDatabase } from '../../services/db/migrations';
import { markAbandonedProviderUploadsInterrupted } from '../../services/db/providerUploadRepository';
import { registerExportProviders } from '../../services/export/registerExportProviders';
import { useSavedGearStore } from '../../store/savedGearStore';
import { useAppPreferencesStore } from '../../store/appPreferencesStore';
import { useProviderGearLinkStore } from '../../store/providerGearLinkStore';
import { useStravaConnectionStore } from '../../store/stravaConnectionStore';
import { useAppleHealthConnectionStore } from '../../store/appleHealthConnectionStore';
import { useUserProfileStore } from '../../store/userProfileStore';

jest.mock('../../services/db/migrations', () => ({ initializeDatabase: jest.fn() }));
jest.mock('../../services/db/providerUploadRepository', () => ({
  markAbandonedProviderUploadsInterrupted: jest.fn().mockReturnValue(0),
}));
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

// The ride is owned by exactly one lifecycle instance, mounted here at boot. The
// stub counts mounts rather than calls, so a re-render cannot be mistaken for a
// second owner, and a second mount (or an unmount mid-boot) fails the test.
const mockLifecycleMount = jest.fn();
const mockLifecycleUnmount = jest.fn();

jest.mock('../../features/training/hooks/useTrainingSessionLifecycle', () => {
  const react = jest.requireActual('react') as {
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => void;
  };
  return {
    useTrainingSessionLifecycle: () => {
      react.useEffect(() => {
        mockLifecycleMount();
        return () => {
          mockLifecycleUnmount();
        };
      }, []);
    },
  };
});
// Reconnect policy is global for the same reason the ride is, and gets the same
// mount-counting stub: two owners would mean two probe budgets for one bike.
const mockReconnectLifecycleMount = jest.fn();
const mockReconnectLifecycleUnmount = jest.fn();

jest.mock('../../features/gear/hooks/useAutoReconnectLifecycle', () => {
  const react = jest.requireActual('react') as {
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => void;
  };
  return {
    useAutoReconnectLifecycle: () => {
      react.useEffect(() => {
        mockReconnectLifecycleMount();
        return () => {
          mockReconnectLifecycleUnmount();
        };
      }, []);
    },
  };
});
jest.mock('../../features/training/hooks/useTrainingSessionPersistence', () => ({
  useTrainingSessionPersistence: jest.fn(),
}));
jest.mock('../../features/training/hooks/useInterruptedSessionRecovery', () => ({
  useInterruptedSessionRecovery: jest.fn(),
}));

const mockInit = initializeDatabase as jest.Mock;
const mockMarkAbandonedUploads = markAbandonedProviderUploadsInterrupted as jest.Mock;

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
  mockMarkAbandonedUploads.mockReturnValue(0);
  setAllHydrated();
});

describe('useAppInitialization', () => {
  it('registers providers and hydrates the stores on mount', async () => {
    mockInit.mockResolvedValue(undefined);
    await renderHook(() => useAppInitialization());
    await waitFor(() => expect(registerExportProviders).toHaveBeenCalled());
  });

  it('reports ready once the database initializes and all stores are hydrated', async () => {
    mockInit.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current).toEqual({ phase: 'ready', onboardingCompleted: false });
  });

  it('passes through onboardingCompleted', async () => {
    mockInit.mockResolvedValue(undefined);
    setAllHydrated(true);
    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current).toEqual({ phase: 'ready', onboardingCompleted: true });
  });

  it('reclassifies uploads abandoned by a previous launch once the database is ready', async () => {
    mockInit.mockResolvedValue(undefined);
    mockMarkAbandonedUploads.mockReturnValue(1);

    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('ready'));

    expect(mockMarkAbandonedUploads).toHaveBeenCalledTimes(1);
  });

  it('sweeps abandoned uploads once per launch even across a database-init retry cycle', async () => {
    // StrictMode's double-invoke does not exercise the guard: both passes take the early
    // return before `isDatabaseReady` is ever true, so it cannot prove the guard does
    // anything. The guard's only reachable trigger is `isDatabaseReady` flipping
    // false -> true a second time within one launch, which happens when a retry fails
    // after an earlier retry already succeeded. `retry` is part of the returned
    // `AppInitState` and is not single-use, so this is reachable through the hook's
    // public API: reject, retry, resolve, retry, reject, retry, resolve.
    mockInit
      .mockRejectedValueOnce(new Error('boot db boom'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('retry db boom'))
      .mockResolvedValueOnce(undefined);

    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('error'));
    const errorState = result.current;
    if (errorState.phase !== 'error') throw new Error('expected error phase');
    const retry = errorState.retry;

    await act(() => retry());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(mockMarkAbandonedUploads).toHaveBeenCalledTimes(1);

    await act(() => retry());
    await waitFor(() => expect(result.current.phase).toBe('error'));

    await act(() => retry());
    await waitFor(() => expect(result.current.phase).toBe('ready'));

    // The second success must not re-run the sweep: it already ran once this launch.
    expect(mockMarkAbandonedUploads).toHaveBeenCalledTimes(1);
  });

  it('does not sweep abandoned uploads while the database is still initializing', async () => {
    mockInit.mockRejectedValue(new Error('db boom'));

    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('error'));

    expect(mockMarkAbandonedUploads).not.toHaveBeenCalled();
  });

  it('still boots when the abandoned-upload sweep throws', async () => {
    mockInit.mockResolvedValue(undefined);
    mockMarkAbandonedUploads.mockImplementation(() => {
      throw new Error('sweep boom');
    });

    const { result } = await renderHook(() => useAppInitialization());

    await waitFor(() => expect(result.current.phase).toBe('ready'));
  });

  it('stays loading while a store is not yet hydrated', async () => {
    mockInit.mockResolvedValue(undefined);
    mockStore(useUserProfileStore, { hydrate: jest.fn().mockResolvedValue(undefined), hydrated: false });
    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(registerExportProviders).toHaveBeenCalled());
    expect(result.current.phase).toBe('loading');
  });

  it('mounts the root-owned training session lifecycle exactly once', async () => {
    mockInit.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('ready'));

    expect(mockLifecycleMount).toHaveBeenCalledTimes(1);
    expect(mockLifecycleUnmount).not.toHaveBeenCalled();
  });

  it('mounts the root-owned reconnect lifecycle exactly once', async () => {
    mockInit.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('ready'));

    expect(mockReconnectLifecycleMount).toHaveBeenCalledTimes(1);
    expect(mockReconnectLifecycleUnmount).not.toHaveBeenCalled();
  });

  it('keeps the single lifecycle owner mounted across a database-init retry', async () => {
    mockInit.mockRejectedValueOnce(new Error('db boom')).mockResolvedValueOnce(undefined);
    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('error'));

    const errorState = result.current;
    if (errorState.phase !== 'error') throw new Error('expected error phase');
    await act(() => errorState.retry());
    await waitFor(() => expect(result.current.phase).toBe('ready'));

    expect(mockLifecycleMount).toHaveBeenCalledTimes(1);
    expect(mockLifecycleUnmount).not.toHaveBeenCalled();
    expect(mockReconnectLifecycleMount).toHaveBeenCalledTimes(1);
    expect(mockReconnectLifecycleUnmount).not.toHaveBeenCalled();
  });

  it('reports error and retry re-runs database init when init fails', async () => {
    mockInit.mockRejectedValueOnce(new Error('db boom')).mockResolvedValueOnce(undefined);
    const { result } = await renderHook(() => useAppInitialization());
    await waitFor(() => expect(result.current.phase).toBe('error'));
    const errorState = result.current;
    if (errorState.phase !== 'error') throw new Error('expected error phase');
    await act(() => errorState.retry());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(mockInit).toHaveBeenCalledTimes(2);
  });
});
