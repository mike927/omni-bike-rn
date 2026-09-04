import { renderHook, waitFor } from '@testing-library/react-native';

import { initWithWritePermissions } from '../../../../services/health/appleHealthAdapter';
import { useAppleHealthConnectionStore } from '../../../../store/appleHealthConnectionStore';
import { useAppleHealthPermissionsRefresh } from '../useAppleHealthPermissionsRefresh';

jest.mock('../../../../services/health/appleHealthAdapter', () => ({
  initWithWritePermissions: jest.fn(),
}));

jest.mock('../../../../store/appleHealthConnectionStore', () => ({
  useAppleHealthConnectionStore: jest.fn(),
}));

const mockInit = initWithWritePermissions as jest.Mock;
const mockUseStore = useAppleHealthConnectionStore as unknown as jest.Mock;

type StoreState = { hydrated: boolean; connected: boolean };

function mockStore(state: StoreState) {
  mockUseStore.mockImplementation((selector: (s: StoreState) => unknown) => selector(state));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInit.mockResolvedValue(undefined);
});

describe('useAppleHealthPermissionsRefresh', () => {
  it('re-invokes initWithWritePermissions once when hydrated and connected', async () => {
    mockStore({ hydrated: true, connected: true });

    await renderHook(() => useAppleHealthPermissionsRefresh());

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });
  });

  it('does not invoke initWithWritePermissions while the store is still hydrating', async () => {
    mockStore({ hydrated: false, connected: true });

    await renderHook(() => useAppleHealthPermissionsRefresh());

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('does not invoke initWithWritePermissions when the user is not connected', async () => {
    mockStore({ hydrated: true, connected: false });

    await renderHook(() => useAppleHealthPermissionsRefresh());

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('only refreshes once per mount even if the hook re-renders', async () => {
    mockStore({ hydrated: true, connected: true });

    const { rerender } = await renderHook(() => useAppleHealthPermissionsRefresh());

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    await rerender({});
    await rerender({});

    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('swallows initWithWritePermissions failures without throwing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    mockInit.mockRejectedValue(new Error('permission refresh denied'));
    mockStore({ hydrated: true, connected: true });

    await renderHook(() => useAppleHealthPermissionsRefresh());

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useAppleHealthPermissionsRefresh] refresh failed:',
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
