import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { UserProfileScreen } from '../UserProfileScreen';
import { loadProfileFromAppleHealth } from '../../../../services/health/appleHealthAdapter';
import { loadProfileFromStrava } from '../../../../services/strava/stravaProfileService';
import { useAppleHealthConnectionStore } from '../../../../store/appleHealthConnectionStore';
import { useStravaConnectionStore } from '../../../../store/stravaConnectionStore';
import { useUserProfileStore } from '../../../../store/userProfileStore';
import { EMPTY_USER_PROFILE } from '../../../../types/userProfile';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../../../services/profile/userProfileStorage', () => ({
  loadUserProfile: jest.fn().mockResolvedValue({
    sex: null,
    dateOfBirth: null,
    weightKg: null,
    heightCm: null,
    sources: {},
  }),
  saveUserProfile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../services/health/appleHealthAdapter', () => ({
  loadProfileFromAppleHealth: jest.fn(),
}));

jest.mock('../../../../services/strava/stravaProfileService', () => ({
  loadProfileFromStrava: jest.fn(),
}));

const mockLoadAppleHealth = loadProfileFromAppleHealth as jest.Mock;
const mockLoadStrava = loadProfileFromStrava as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useUserProfileStore.setState({ profile: { ...EMPTY_USER_PROFILE, sources: {} }, hydrated: true });
  useAppleHealthConnectionStore.setState({ connected: false, hydrated: true });
  useStravaConnectionStore.setState({ connected: false, athlete: null, hydrated: true });
  mockLoadAppleHealth.mockReset();
  mockLoadStrava.mockReset();
});

describe('UserProfileScreen', () => {
  it('shows a no-provider helper when neither Apple Health nor Strava is connected', () => {
    const { getByText } = render(<UserProfileScreen />);
    expect(
      getByText(
        'Connect Apple Health or Strava in Settings to sync your profile, or fill in the fields below manually.',
      ),
    ).toBeTruthy();
  });

  it('replaces the no-provider helper with the explicit-sync helper when a provider connects', () => {
    useAppleHealthConnectionStore.setState({ connected: true, hydrated: true });
    const { queryByText, getByText } = render(<UserProfileScreen />);
    expect(
      queryByText(
        'Connect Apple Health or Strava in Settings to sync your profile, or fill in the fields below manually.',
      ),
    ).toBeNull();
    expect(
      getByText(
        /Tap a provider to overwrite your profile fields with the latest values\. Fields the provider doesn't return are left untouched\./,
      ),
    ).toBeTruthy();
  });

  it('shows the source badge for fields auto-filled from Apple Health', () => {
    useUserProfileStore.setState({
      profile: {
        sex: 'female',
        dateOfBirth: '1990-05-12',
        weightKg: 65,
        heightCm: 170,
        sources: {
          sex: 'apple-health',
          dateOfBirth: 'apple-health',
          weightKg: 'apple-health',
          heightCm: 'apple-health',
        },
      },
      hydrated: true,
    });
    const { getAllByText } = render(<UserProfileScreen />);
    // Badge appears once per row (4 rows, 4 badges).
    expect(getAllByText('Apple Health')).toHaveLength(4);
  });

  it('writes a manual sex selection through setManual', async () => {
    const { getByLabelText } = render(<UserProfileScreen />);
    fireEvent.press(getByLabelText('Female'));
    await waitFor(() => {
      const profile = useUserProfileStore.getState().profile;
      expect(profile.sex).toBe('female');
      expect(profile.sources.sex).toBe('manual');
    });
  });

  it('clears a field via the Clear button and marks the source as manual', async () => {
    useUserProfileStore.setState({
      profile: {
        sex: null,
        dateOfBirth: null,
        weightKg: 80,
        heightCm: null,
        sources: { weightKg: 'apple-health' },
      },
      hydrated: true,
    });
    const { getByLabelText } = render(<UserProfileScreen />);
    fireEvent.press(getByLabelText('Clear Weight'));
    await waitFor(() => {
      const profile = useUserProfileStore.getState().profile;
      expect(profile.weightKg).toBeNull();
      expect(profile.sources.weightKg).toBe('manual');
    });
  });

  it('preserves the previous weight when blurring with an empty or invalid draft', async () => {
    useUserProfileStore.setState({
      profile: {
        sex: null,
        dateOfBirth: null,
        weightKg: 75,
        heightCm: null,
        sources: { weightKg: 'apple-health' },
      },
      hydrated: true,
    });
    const { getByDisplayValue } = render(<UserProfileScreen />);
    const weightInput = getByDisplayValue('75');
    fireEvent.changeText(weightInput, '');
    fireEvent(weightInput, 'blur');
    fireEvent.changeText(weightInput, 'abc');
    fireEvent(weightInput, 'blur');
    const profile = useUserProfileStore.getState().profile;
    expect(profile.weightKg).toBe(75);
    expect(profile.sources.weightKg).toBe('apple-health');
  });

  it('preserves the previous DOB when blurring with an incomplete or invalid draft', async () => {
    useUserProfileStore.setState({
      profile: {
        sex: null,
        dateOfBirth: '1990-05-12',
        weightKg: null,
        heightCm: null,
        sources: { dateOfBirth: 'apple-health' },
      },
      hydrated: true,
    });
    const { getByDisplayValue } = render(<UserProfileScreen />);
    const dobInput = getByDisplayValue('1990-05-12');
    fireEvent.changeText(dobInput, '199');
    fireEvent(dobInput, 'blur');
    fireEvent.changeText(dobInput, '');
    fireEvent(dobInput, 'blur');
    const profile = useUserProfileStore.getState().profile;
    expect(profile.dateOfBirth).toBe('1990-05-12');
    expect(profile.sources.dateOfBirth).toBe('apple-health');
  });

  it('does not load from a provider when its sync button is disabled (provider not connected)', () => {
    mockLoadAppleHealth.mockResolvedValue({});
    mockLoadStrava.mockResolvedValue({});
    const { getByText } = render(<UserProfileScreen />);
    fireEvent.press(getByText('Sync from Apple Health'));
    fireEvent.press(getByText('Sync from Strava'));
    expect(mockLoadAppleHealth).not.toHaveBeenCalled();
    expect(mockLoadStrava).not.toHaveBeenCalled();
  });

  it('syncs from Apple Health on tap and overwrites profile fields', async () => {
    useAppleHealthConnectionStore.setState({ connected: true, hydrated: true });
    useUserProfileStore.setState({
      profile: {
        sex: null,
        dateOfBirth: null,
        weightKg: 70,
        heightCm: null,
        sources: { weightKg: 'manual' },
      },
      hydrated: true,
    });
    mockLoadAppleHealth.mockResolvedValue({ sex: 'male', dateOfBirth: '1985-01-01', weightKg: 80, heightCm: 180 });
    const { getByText } = render(<UserProfileScreen />);
    fireEvent.press(getByText('Sync from Apple Health'));
    await waitFor(() => {
      expect(mockLoadAppleHealth).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      const profile = useUserProfileStore.getState().profile;
      expect(profile.weightKg).toBe(80);
      expect(profile.sources.weightKg).toBe('apple-health');
      expect(profile.sex).toBe('male');
    });
    expect(getByText('Updated 4 fields from Apple Health.')).toBeTruthy();
  });

  it('syncs from Strava on tap (only sex + weight, leaving DOB and height untouched)', async () => {
    useStravaConnectionStore.setState({ connected: true, athlete: null, hydrated: true });
    useUserProfileStore.setState({
      profile: {
        sex: null,
        dateOfBirth: '1990-05-12',
        weightKg: null,
        heightCm: 170,
        sources: { dateOfBirth: 'manual', heightCm: 'manual' },
      },
      hydrated: true,
    });
    mockLoadStrava.mockResolvedValue({ sex: 'female', weightKg: 62 });
    const { getByText } = render(<UserProfileScreen />);
    fireEvent.press(getByText('Sync from Strava'));
    await waitFor(() => {
      expect(mockLoadStrava).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      const profile = useUserProfileStore.getState().profile;
      expect(profile.sex).toBe('female');
      expect(profile.sources.sex).toBe('strava');
      expect(profile.weightKg).toBe(62);
      expect(profile.sources.weightKg).toBe('strava');
      expect(profile.dateOfBirth).toBe('1990-05-12');
      expect(profile.sources.dateOfBirth).toBe('manual');
      expect(profile.heightCm).toBe(170);
      expect(profile.sources.heightCm).toBe('manual');
    });
    expect(getByText('Updated 2 fields from Strava.')).toBeTruthy();
  });

  it('shows an error message when the provider load fails', async () => {
    useAppleHealthConnectionStore.setState({ connected: true, hydrated: true });
    mockLoadAppleHealth.mockRejectedValue(new Error('hk read failed'));
    const { getByText } = render(<UserProfileScreen />);
    fireEvent.press(getByText('Sync from Apple Health'));
    await waitFor(() => {
      expect(getByText('Apple Health sync failed: hk read failed')).toBeTruthy();
    });
  });
});
