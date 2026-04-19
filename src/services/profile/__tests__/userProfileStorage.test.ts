import Storage from 'expo-sqlite/kv-store';

import { loadUserProfile, saveUserProfile } from '../userProfileStorage';
import type { UserProfile } from '../../../types/userProfile';

jest.mock('expo-sqlite/kv-store', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGetItem = Storage.getItem as jest.Mock;
const mockSetItem = Storage.setItem as jest.Mock;

const sampleProfile: UserProfile = {
  sex: 'female',
  dateOfBirth: '1990-05-12',
  weightKg: 62,
  heightCm: 168,
  sources: { sex: 'apple-health', dateOfBirth: 'apple-health', weightKg: 'manual', heightCm: 'apple-health' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
});

describe('loadUserProfile', () => {
  it('returns empty profile when nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    const profile = await loadUserProfile();
    expect(profile).toEqual({ sex: null, dateOfBirth: null, weightKg: null, heightCm: null, sources: {} });
  });

  it('returns parsed profile when stored', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(sampleProfile));
    expect(await loadUserProfile()).toEqual(sampleProfile);
  });

  it('returns empty profile when storage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage failure'));
    const profile = await loadUserProfile();
    expect(profile).toEqual({ sex: null, dateOfBirth: null, weightKg: null, heightCm: null, sources: {} });
  });

  it('coerces missing fields to null and missing sources to empty object', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ sex: 'male' }));
    const profile = await loadUserProfile();
    expect(profile).toEqual({ sex: 'male', dateOfBirth: null, weightKg: null, heightCm: null, sources: {} });
  });
});

describe('saveUserProfile', () => {
  it('persists serialized profile under the canonical key', async () => {
    await saveUserProfile(sampleProfile);
    expect(mockSetItem).toHaveBeenCalledWith('omni:userProfile', JSON.stringify(sampleProfile));
  });
});

describe('round-trip', () => {
  it('saves and loads profile correctly', async () => {
    let stored: string | null = null;
    mockSetItem.mockImplementation((_key: string, value: string) => {
      stored = value;
      return Promise.resolve();
    });
    mockGetItem.mockImplementation(() => Promise.resolve(stored));

    await saveUserProfile(sampleProfile);
    expect(await loadUserProfile()).toEqual(sampleProfile);
  });
});
