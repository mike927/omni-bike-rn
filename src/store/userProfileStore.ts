import { create } from 'zustand';

import { loadUserProfile, saveUserProfile } from '../services/profile/userProfileStorage';
import {
  EMPTY_USER_PROFILE,
  type UserProfile,
  type UserProfileField,
  type UserProfileFieldValueMap,
} from '../types/userProfile';

type ProviderSyncSource = 'apple-health' | 'strava';
type ProviderSyncPartial = Partial<{
  [F in UserProfileField]: UserProfileFieldValueMap[F];
}>;

export interface UserProfileStore {
  profile: UserProfile;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setManual: <F extends UserProfileField>(field: F, value: UserProfileFieldValueMap[F] | null) => Promise<void>;
  applyProviderSync: (source: ProviderSyncSource, partial: ProviderSyncPartial) => Promise<void>;
}

function applyFieldUpdate<F extends UserProfileField>(
  profile: UserProfile,
  field: F,
  value: UserProfileFieldValueMap[F] | null,
  source: 'manual' | 'apple-health' | 'strava',
): UserProfile {
  const nextSources = { ...profile.sources, [field]: source };
  return { ...profile, [field]: value, sources: nextSources };
}

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  profile: { ...EMPTY_USER_PROFILE, sources: {} },
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const profile = await loadUserProfile();
    set({ profile, hydrated: true });
  },

  setManual: async (field, value) => {
    const next = applyFieldUpdate(get().profile, field, value, 'manual');
    set({ profile: next });
    await saveUserProfile(next);
  },

  applyProviderSync: async (source, partial) => {
    // Explicit user-tapped sync. Overwrites whatever is in each returned
    // field, including a previously 'manual' value, because the user is
    // actively requesting the provider's value to win.
    let next = get().profile;
    let mutated = false;
    for (const key of Object.keys(partial) as UserProfileField[]) {
      const value = partial[key];
      if (value === undefined) continue;
      next = applyFieldUpdate(next, key, value, source);
      mutated = true;
    }
    if (!mutated) return;
    set({ profile: next });
    await saveUserProfile(next);
  },
}));
