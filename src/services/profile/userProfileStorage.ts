import Storage from 'expo-sqlite/kv-store';

import { EMPTY_USER_PROFILE, type UserProfile } from '../../types/userProfile';

const STORAGE_KEY = 'omni:userProfile';

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_USER_PROFILE, sources: {} };
    const parsed = JSON.parse(raw) as UserProfile;
    return {
      sex: parsed.sex ?? null,
      dateOfBirth: parsed.dateOfBirth ?? null,
      weightKg: parsed.weightKg ?? null,
      heightCm: parsed.heightCm ?? null,
      sources: parsed.sources ?? {},
    };
  } catch (err: unknown) {
    console.error('[userProfileStorage] Failed to load profile:', err);
    return { ...EMPTY_USER_PROFILE, sources: {} };
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
