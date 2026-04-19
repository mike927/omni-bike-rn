import { renderHook, waitFor } from '@testing-library/react-native';

import { loadProfileFromAppleHealth } from '../../../../services/health/appleHealthAdapter';
import { loadProfileFromStrava } from '../../../../services/strava/stravaProfileService';
import { useAppleHealthConnectionStore } from '../../../../store/appleHealthConnectionStore';
import { useStravaConnectionStore } from '../../../../store/stravaConnectionStore';
import { useUserProfileStore } from '../../../../store/userProfileStore';
import { useProfileAutoSync } from '../useProfileAutoSync';

jest.mock('../../../../services/health/appleHealthAdapter', () => ({
  loadProfileFromAppleHealth: jest.fn(),
}));

jest.mock('../../../../services/strava/stravaProfileService', () => ({
  loadProfileFromStrava: jest.fn(),
}));

jest.mock('../../../../store/appleHealthConnectionStore', () => ({
  useAppleHealthConnectionStore: jest.fn(),
}));

jest.mock('../../../../store/stravaConnectionStore', () => ({
  useStravaConnectionStore: jest.fn(),
}));

jest.mock('../../../../store/userProfileStore', () => ({
  useUserProfileStore: jest.fn(),
}));

const mockLoadAppleHealth = loadProfileFromAppleHealth as jest.Mock;
const mockLoadStrava = loadProfileFromStrava as jest.Mock;
const mockUseAppleHealth = useAppleHealthConnectionStore as unknown as jest.Mock;
const mockUseStrava = useStravaConnectionStore as unknown as jest.Mock;
const mockUseProfile = useUserProfileStore as unknown as jest.Mock;

interface AppleHealthState {
  hydrated: boolean;
  connected: boolean;
}
interface StravaState {
  hydrated: boolean;
  connected: boolean;
}
interface ProfileState {
  hydrated: boolean;
  applyAutoSync: jest.Mock;
}

const mockApplyAutoSync = jest.fn().mockResolvedValue(undefined);

function setStores({
  appleHealth,
  strava,
  profile,
}: {
  appleHealth: AppleHealthState;
  strava: StravaState;
  profile: ProfileState;
}) {
  mockUseAppleHealth.mockImplementation((selector: (s: AppleHealthState) => unknown) => selector(appleHealth));
  mockUseStrava.mockImplementation((selector: (s: StravaState) => unknown) => selector(strava));
  mockUseProfile.mockImplementation((selector: (s: ProfileState) => unknown) => selector(profile));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadAppleHealth.mockResolvedValue({ sex: 'male', weightKg: 80 });
  mockLoadStrava.mockResolvedValue({ sex: 'male', weightKg: 80 });
});

describe('useProfileAutoSync', () => {
  it('runs the Apple Health sync once when already connected at mount', async () => {
    setStores({
      appleHealth: { hydrated: true, connected: true },
      strava: { hydrated: true, connected: false },
      profile: { hydrated: true, applyAutoSync: mockApplyAutoSync },
    });

    renderHook(() => useProfileAutoSync());

    await waitFor(() => {
      expect(mockLoadAppleHealth).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockApplyAutoSync).toHaveBeenCalledWith('apple-health', { sex: 'male', weightKg: 80 });
    });
  });

  it('seeds from Strava only when Apple Health is not connected', async () => {
    setStores({
      appleHealth: { hydrated: true, connected: false },
      strava: { hydrated: true, connected: true },
      profile: { hydrated: true, applyAutoSync: mockApplyAutoSync },
    });

    renderHook(() => useProfileAutoSync());

    await waitFor(() => {
      expect(mockLoadStrava).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockApplyAutoSync).toHaveBeenCalledWith('strava', { sex: 'male', weightKg: 80 });
    });
  });

  it('does not seed from Strava when Apple Health is connected', async () => {
    setStores({
      appleHealth: { hydrated: true, connected: true },
      strava: { hydrated: true, connected: true },
      profile: { hydrated: true, applyAutoSync: mockApplyAutoSync },
    });

    renderHook(() => useProfileAutoSync());

    await waitFor(() => {
      expect(mockLoadAppleHealth).toHaveBeenCalledTimes(1);
    });
    expect(mockLoadStrava).not.toHaveBeenCalled();
  });

  it('does not run any sync until the profile store has hydrated', () => {
    setStores({
      appleHealth: { hydrated: true, connected: true },
      strava: { hydrated: true, connected: true },
      profile: { hydrated: false, applyAutoSync: mockApplyAutoSync },
    });

    renderHook(() => useProfileAutoSync());

    expect(mockLoadAppleHealth).not.toHaveBeenCalled();
    expect(mockLoadStrava).not.toHaveBeenCalled();
  });

  it('logs and swallows Apple Health load failures', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    mockLoadAppleHealth.mockRejectedValue(new Error('hk read failed'));
    setStores({
      appleHealth: { hydrated: true, connected: true },
      strava: { hydrated: true, connected: false },
      profile: { hydrated: true, applyAutoSync: mockApplyAutoSync },
    });

    renderHook(() => useProfileAutoSync());

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('[useProfileAutoSync] Apple Health sync failed:', expect.any(Error));
    });
    expect(mockApplyAutoSync).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('does not re-sync Apple Health when it was already connected on the previous render', async () => {
    setStores({
      appleHealth: { hydrated: true, connected: true },
      strava: { hydrated: true, connected: false },
      profile: { hydrated: true, applyAutoSync: mockApplyAutoSync },
    });

    const { rerender } = renderHook(() => useProfileAutoSync());

    await waitFor(() => {
      expect(mockLoadAppleHealth).toHaveBeenCalledTimes(1);
    });

    rerender({});
    rerender({});

    expect(mockLoadAppleHealth).toHaveBeenCalledTimes(1);
  });

  it('falls back to Strava when Apple Health disconnects and Strava was already connected at mount', async () => {
    setStores({
      appleHealth: { hydrated: true, connected: true },
      strava: { hydrated: true, connected: true },
      profile: { hydrated: true, applyAutoSync: mockApplyAutoSync },
    });

    const { rerender } = renderHook(() => useProfileAutoSync());

    await waitFor(() => {
      expect(mockLoadAppleHealth).toHaveBeenCalledTimes(1);
    });
    expect(mockLoadStrava).not.toHaveBeenCalled();

    setStores({
      appleHealth: { hydrated: true, connected: false },
      strava: { hydrated: true, connected: true },
      profile: { hydrated: true, applyAutoSync: mockApplyAutoSync },
    });
    rerender({});

    await waitFor(() => {
      expect(mockLoadStrava).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockApplyAutoSync).toHaveBeenCalledWith('strava', { sex: 'male', weightKg: 80 });
    });
  });
});
