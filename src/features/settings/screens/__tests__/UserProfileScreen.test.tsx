import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { UserProfileScreen } from '../UserProfileScreen';
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

beforeEach(() => {
  jest.clearAllMocks();
  useUserProfileStore.setState({ profile: { ...EMPTY_USER_PROFILE, sources: {} }, hydrated: true });
  useAppleHealthConnectionStore.setState({ connected: false, hydrated: true });
  useStravaConnectionStore.setState({ connected: false, athlete: null, hydrated: true });
});

describe('UserProfileScreen', () => {
  it('renders the empty-state helper when no fields and no provider are set', () => {
    const { getByText } = render(<UserProfileScreen />);
    expect(
      getByText('Connect Apple Health or Strava to auto-fill your profile, or fill in the fields below manually.'),
    ).toBeTruthy();
  });

  it('hides the empty-state helper once any field is populated', () => {
    useUserProfileStore.setState({
      profile: {
        sex: 'male',
        dateOfBirth: null,
        weightKg: null,
        heightCm: null,
        sources: { sex: 'apple-health' },
      },
      hydrated: true,
    });
    const { queryByText } = render(<UserProfileScreen />);
    expect(
      queryByText('Connect Apple Health or Strava to auto-fill your profile, or fill in the fields below manually.'),
    ).toBeNull();
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
});
