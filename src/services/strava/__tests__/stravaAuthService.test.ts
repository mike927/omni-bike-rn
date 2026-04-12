import * as WebBrowser from 'expo-web-browser';

import {
  authorizeWithStrava,
  disconnectStrava,
  getConnectedAthlete,
  getValidAccessToken,
  isStravaConnected,
  refreshAccessToken,
} from '../stravaAuthService';
import { clearTokens, loadTokens, saveTokens } from '../stravaTokenStorage';
import type { StravaTokens } from '../types';

jest.mock('expo-web-browser');
jest.mock('../stravaTokenStorage');
jest.mock('../stravaConstants', () => ({
  STRAVA_AUTH_URL: 'https://www.strava.com/oauth/mobile/authorize',
  STRAVA_TOKEN_URL: 'https://www.strava.com/oauth/token',
  STRAVA_DEAUTH_URL: 'https://www.strava.com/oauth/deauthorize',
  STRAVA_REDIRECT_URI: 'omnibike://oauth/callback',
  STRAVA_CLIENT_ID: 'test-client-id',
  STRAVA_CLIENT_SECRET: 'test-client-secret',
  STRAVA_SCOPES: 'activity:write,read',
  TOKEN_EXPIRY_BUFFER_MS: 300_000,
}));

const mockOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const mockLoadTokens = loadTokens as jest.Mock;
const mockSaveTokens = saveTokens as jest.Mock;
const mockClearTokens = clearTokens as jest.Mock;

const FAR_FUTURE_EXPIRES_AT = Math.floor(Date.now() / 1000) + 7200;

const SAMPLE_TOKENS: StravaTokens = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  expiresAt: FAR_FUTURE_EXPIRES_AT,
  athlete: { id: 1, firstName: 'Jane', lastName: 'Rider' },
};

const MOCK_TOKEN_RESPONSE = {
  access_token: 'new-access',
  refresh_token: 'new-refresh',
  expires_at: FAR_FUTURE_EXPIRES_AT,
  athlete: { id: 1, firstname: 'Jane', lastname: 'Rider' },
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe('authorizeWithStrava', () => {
  it('exchanges code for tokens and saves them', async () => {
    const redirectUrl = 'omnibike://oauth/callback?code=auth-code-123';
    mockOpenAuthSession.mockResolvedValue({ type: 'success', url: redirectUrl });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    });
    mockSaveTokens.mockResolvedValue(undefined);

    const result = await authorizeWithStrava();

    expect(result.accessToken).toBe('new-access');
    expect(result.athlete.firstName).toBe('Jane');
    expect(mockSaveTokens).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-access' }));
  });

  it('throws when user cancels the browser flow', async () => {
    mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });
    await expect(authorizeWithStrava()).rejects.toThrow('cancelled or failed');
  });

  it('throws when the redirect URL has no code', async () => {
    const redirectUrl = 'omnibike://oauth/callback?error=access_denied';
    mockOpenAuthSession.mockResolvedValue({ type: 'success', url: redirectUrl });
    await expect(authorizeWithStrava()).rejects.toThrow('access_denied');
  });

  it('throws when token exchange HTTP request fails', async () => {
    const redirectUrl = 'omnibike://oauth/callback?code=code-123';
    mockOpenAuthSession.mockResolvedValue({ type: 'success', url: redirectUrl });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(authorizeWithStrava()).rejects.toThrow('401');
  });
});

describe('refreshAccessToken', () => {
  it('posts with refresh_token grant and saves new tokens', async () => {
    mockLoadTokens.mockResolvedValue(SAMPLE_TOKENS);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...MOCK_TOKEN_RESPONSE, athlete: undefined }),
    });
    mockSaveTokens.mockResolvedValue(undefined);

    const result = await refreshAccessToken();

    expect(result.accessToken).toBe('new-access');
    // Athlete carried over from stored tokens when absent in refresh response.
    expect(result.athlete).toEqual(SAMPLE_TOKENS.athlete);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string) as Record<string, string>;
    expect(body.grant_type).toBe('refresh_token');
    expect(body.refresh_token).toBe(SAMPLE_TOKENS.refreshToken);
  });

  it('throws when no tokens are stored', async () => {
    mockLoadTokens.mockResolvedValue(null);
    await expect(refreshAccessToken()).rejects.toThrow('no tokens stored');
  });
});

describe('getValidAccessToken', () => {
  it('returns stored token when not expired', async () => {
    mockLoadTokens.mockResolvedValue(SAMPLE_TOKENS);
    const token = await getValidAccessToken();
    expect(token).toBe(SAMPLE_TOKENS.accessToken);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refreshes and returns new token when near expiry', async () => {
    const expiredTokens: StravaTokens = { ...SAMPLE_TOKENS, expiresAt: Math.floor(Date.now() / 1000) - 60 };
    mockLoadTokens.mockResolvedValue(expiredTokens);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    });
    mockSaveTokens.mockResolvedValue(undefined);

    const token = await getValidAccessToken();
    expect(token).toBe('new-access');
  });

  it('throws when not connected', async () => {
    mockLoadTokens.mockResolvedValue(null);
    await expect(getValidAccessToken()).rejects.toThrow('Not connected');
  });
});

describe('disconnectStrava', () => {
  it('calls deauth endpoint and clears tokens', async () => {
    mockLoadTokens.mockResolvedValue(SAMPLE_TOKENS);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    mockClearTokens.mockResolvedValue(undefined);

    await disconnectStrava();

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[0]).toContain('deauthorize');
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it('clears tokens even when deauth request fails', async () => {
    mockLoadTokens.mockResolvedValue(SAMPLE_TOKENS);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network error'));
    mockClearTokens.mockResolvedValue(undefined);

    await disconnectStrava();

    expect(mockClearTokens).toHaveBeenCalled();
  });

  it('clears tokens when no stored tokens exist', async () => {
    mockLoadTokens.mockResolvedValue(null);
    mockClearTokens.mockResolvedValue(undefined);

    await disconnectStrava();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockClearTokens).toHaveBeenCalled();
  });
});

describe('isStravaConnected', () => {
  it('returns true when tokens exist', async () => {
    mockLoadTokens.mockResolvedValue(SAMPLE_TOKENS);
    expect(await isStravaConnected()).toBe(true);
  });

  it('returns false when no tokens', async () => {
    mockLoadTokens.mockResolvedValue(null);
    expect(await isStravaConnected()).toBe(false);
  });
});

describe('getConnectedAthlete', () => {
  it('returns athlete when connected', async () => {
    mockLoadTokens.mockResolvedValue(SAMPLE_TOKENS);
    expect(await getConnectedAthlete()).toEqual(SAMPLE_TOKENS.athlete);
  });

  it('returns null when not connected', async () => {
    mockLoadTokens.mockResolvedValue(null);
    expect(await getConnectedAthlete()).toBeNull();
  });
});
