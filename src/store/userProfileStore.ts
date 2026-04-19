import { create } from 'zustand';

import { loadUserProfile, saveUserProfile } from '../services/profile/userProfileStorage';
import {
  EMPTY_USER_PROFILE,
  type UserProfile,
  type UserProfileField,
  type UserProfileFieldValueMap,
} from '../types/userProfile';

type AutoSyncSource = 'apple-health' | 'strava';
type AutoSyncPartial = Partial<{
  [F in UserProfileField]: UserProfileFieldValueMap[F] | null;
}>;

export interface UserProfileStore {
  profile: UserProfile;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setManual: <F extends UserProfileField>(field: F, value: UserProfileFieldValueMap[F] | null) => Promise<void>;
  applyAutoSync: (source: AutoSyncSource, partial: AutoSyncPartial) => Promise<void>;
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

  applyAutoSync: async (source, partial) => {
    let next = get().profile;
    let mutated = false;
    for (const key of Object.keys(partial) as UserProfileField[]) {
      if (next.sources[key] === 'manual') continue;
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
