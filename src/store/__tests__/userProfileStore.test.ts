import { useUserProfileStore } from '../userProfileStore';
import * as storage from '../../services/profile/userProfileStorage';
import { EMPTY_USER_PROFILE, type UserProfile } from '../../types/userProfile';

jest.mock('../../services/profile/userProfileStorage');

const mockLoad = storage.loadUserProfile as jest.Mock;
const mockSave = storage.saveUserProfile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useUserProfileStore.setState({
    profile: { ...EMPTY_USER_PROFILE, sources: {} },
    hydrated: false,
  });
  mockSave.mockResolvedValue(undefined);
});

describe('hydrate', () => {
  it('loads profile from storage and marks hydrated', async () => {
    const stored: UserProfile = {
      sex: 'male',
      dateOfBirth: '1985-01-01',
      weightKg: 80,
      heightCm: 178,
      sources: { sex: 'apple-health', dateOfBirth: 'apple-health', weightKg: 'manual', heightCm: 'apple-health' },
    };
    mockLoad.mockResolvedValue(stored);
    await useUserProfileStore.getState().hydrate();
    const state = useUserProfileStore.getState();
    expect(state.profile).toEqual(stored);
    expect(state.hydrated).toBe(true);
  });

  it('does not reload when already hydrated', async () => {
    useUserProfileStore.setState({ hydrated: true });
    await useUserProfileStore.getState().hydrate();
    expect(mockLoad).not.toHaveBeenCalled();
  });
});

describe('setManual', () => {
  it('stores the value and marks the field source manual', async () => {
    await useUserProfileStore.getState().setManual('weightKg', 75);
    const profile = useUserProfileStore.getState().profile;
    expect(profile.weightKg).toBe(75);
    expect(profile.sources.weightKg).toBe('manual');
    expect(mockSave).toHaveBeenCalledWith(profile);
  });

  it('clears the value with null and still marks source manual to block silent re-sync', async () => {
    useUserProfileStore.setState({
      profile: {
        sex: 'female',
        dateOfBirth: '1990-05-12',
        weightKg: 62,
        heightCm: 168,
        sources: {
          sex: 'apple-health',
          dateOfBirth: 'apple-health',
          weightKg: 'apple-health',
          heightCm: 'apple-health',
        },
      },
    });
    await useUserProfileStore.getState().setManual('weightKg', null);
    const profile = useUserProfileStore.getState().profile;
    expect(profile.weightKg).toBeNull();
    expect(profile.sources.weightKg).toBe('manual');
  });
});

describe('applyAutoSync', () => {
  it('overwrites non-manual fields with the source label', async () => {
    await useUserProfileStore
      .getState()
      .applyAutoSync('apple-health', { sex: 'male', dateOfBirth: '1985-03-10', weightKg: 80, heightCm: 180 });
    const profile = useUserProfileStore.getState().profile;
    expect(profile).toEqual({
      sex: 'male',
      dateOfBirth: '1985-03-10',
      weightKg: 80,
      heightCm: 180,
      sources: {
        sex: 'apple-health',
        dateOfBirth: 'apple-health',
        weightKg: 'apple-health',
        heightCm: 'apple-health',
      },
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('preserves a manual override and updates other non-manual fields', async () => {
    useUserProfileStore.setState({
      profile: {
        sex: null,
        dateOfBirth: null,
        weightKg: 75,
        heightCm: null,
        sources: { weightKg: 'manual' },
      },
    });
    await useUserProfileStore
      .getState()
      .applyAutoSync('apple-health', { sex: 'female', dateOfBirth: '1992-06-01', weightKg: 60, heightCm: 165 });
    const profile = useUserProfileStore.getState().profile;
    expect(profile.weightKg).toBe(75);
    expect(profile.sources.weightKg).toBe('manual');
    expect(profile.sex).toBe('female');
    expect(profile.sources.sex).toBe('apple-health');
    expect(profile.heightCm).toBe(165);
    expect(profile.sources.heightCm).toBe('apple-health');
  });

  it('preserves a manually-cleared field across auto-sync', async () => {
    useUserProfileStore.setState({
      profile: {
        sex: 'female',
        dateOfBirth: '1990-05-12',
        weightKg: null,
        heightCm: 168,
        sources: { sex: 'apple-health', dateOfBirth: 'apple-health', weightKg: 'manual', heightCm: 'apple-health' },
      },
    });
    await useUserProfileStore.getState().applyAutoSync('strava', { weightKg: 60, sex: 'female' });
    const profile = useUserProfileStore.getState().profile;
    expect(profile.weightKg).toBeNull();
    expect(profile.sources.weightKg).toBe('manual');
  });

  it('does not write to storage when nothing changes', async () => {
    useUserProfileStore.setState({
      profile: {
        sex: 'male',
        dateOfBirth: '1985-01-01',
        weightKg: 80,
        heightCm: 180,
        sources: { sex: 'manual', dateOfBirth: 'manual', weightKg: 'manual', heightCm: 'manual' },
      },
    });
    await useUserProfileStore
      .getState()
      .applyAutoSync('apple-health', { sex: 'female', dateOfBirth: '1990-01-01', weightKg: 60, heightCm: 160 });
    expect(mockSave).not.toHaveBeenCalled();
  });
});
