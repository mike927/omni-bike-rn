import * as SecureStore from 'expo-secure-store';

import { clearTokens, loadTokens, saveTokens } from '../stravaTokenStorage';
import type { StravaTokens } from '../types';

jest.mock('expo-secure-store');

jest.mock('../stravaConstants', () => ({
  SECURE_STORE_ACCESS_TOKEN_KEY: 'strava:accessToken',
  SECURE_STORE_REFRESH_TOKEN_KEY: 'strava:refreshToken',
  SECURE_STORE_EXPIRES_AT_KEY: 'strava:expiresAt',
  SECURE_STORE_ATHLETE_KEY: 'strava:athlete',
}));

const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

const SAMPLE_TOKENS: StravaTokens = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  expiresAt: 9_999_999_999,
  athlete: { id: 42, firstName: 'Jane', lastName: 'Rider' },
};

describe('stravaTokenStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('saveTokens', () => {
    it('writes all four keys to secure store', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await saveTokens(SAMPLE_TOKENS);

      expect(mockSetItem).toHaveBeenCalledTimes(4);
      expect(mockSetItem).toHaveBeenCalledWith('strava:accessToken', 'access-abc');
      expect(mockSetItem).toHaveBeenCalledWith('strava:refreshToken', 'refresh-xyz');
      expect(mockSetItem).toHaveBeenCalledWith('strava:expiresAt', '9999999999');
      expect(mockSetItem).toHaveBeenCalledWith('strava:athlete', JSON.stringify(SAMPLE_TOKENS.athlete));
    });
  });

  describe('loadTokens', () => {
    it('returns null when any key is missing', async () => {
      mockGetItem.mockResolvedValue(null);
      const result = await loadTokens();
      expect(result).toBeNull();
    });

    it('returns null when expiresAt is not a valid number', async () => {
      mockGetItem.mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'strava:accessToken': 'access-abc',
          'strava:refreshToken': 'refresh-xyz',
          'strava:expiresAt': 'not-a-number',
          'strava:athlete': JSON.stringify(SAMPLE_TOKENS.athlete),
        };
        return Promise.resolve(map[key] ?? null);
      });
      const result = await loadTokens();
      expect(result).toBeNull();
    });

    it('returns null when athlete JSON is malformed', async () => {
      mockGetItem.mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'strava:accessToken': 'access-abc',
          'strava:refreshToken': 'refresh-xyz',
          'strava:expiresAt': '9999999999',
          'strava:athlete': '{bad json',
        };
        return Promise.resolve(map[key] ?? null);
      });
      const result = await loadTokens();
      expect(result).toBeNull();
    });

    it('returns full StravaTokens when all keys are present and valid', async () => {
      mockGetItem.mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'strava:accessToken': SAMPLE_TOKENS.accessToken,
          'strava:refreshToken': SAMPLE_TOKENS.refreshToken,
          'strava:expiresAt': String(SAMPLE_TOKENS.expiresAt),
          'strava:athlete': JSON.stringify(SAMPLE_TOKENS.athlete),
        };
        return Promise.resolve(map[key] ?? null);
      });
      const result = await loadTokens();
      expect(result).toEqual(SAMPLE_TOKENS);
    });
  });

  describe('clearTokens', () => {
    it('deletes all four keys', async () => {
      mockDeleteItem.mockResolvedValue(undefined);
      await clearTokens();

      expect(mockDeleteItem).toHaveBeenCalledTimes(4);
      expect(mockDeleteItem).toHaveBeenCalledWith('strava:accessToken');
      expect(mockDeleteItem).toHaveBeenCalledWith('strava:refreshToken');
      expect(mockDeleteItem).toHaveBeenCalledWith('strava:expiresAt');
      expect(mockDeleteItem).toHaveBeenCalledWith('strava:athlete');
    });
  });
});
