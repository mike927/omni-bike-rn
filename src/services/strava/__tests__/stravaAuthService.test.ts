import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

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

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('../stravaTokenStorage');
jest.mock('../stravaConstants', () => ({
  STRAVA_AUTH_URL: 'https://www.strava.com/oauth/mobile/authorize',
  STRAVA_TOKEN_URL: 'https://www.strava.com/oauth/token',
  STRAVA_DEAUTH_URL: 'https://www.strava.com/oauth/deauthorize',
  STRAVA_REDIRECT_URI: 'omnibike://localhost/oauth/callback',
  STRAVA_CLIENT_ID: 'test-client-id',
  STRAVA_CLIENT_SECRET: 'test-client-secret',
  STRAVA_SCOPES: 'activity:write,activity:read_all,read,profile:read_all',
  TOKEN_EXPIRY_BUFFER_MS: 300_000,
}));

const mockOpenBrowser = WebBrowser.openBrowserAsync as jest.Mock;
const mockDismissBrowser = WebBrowser.dismissBrowser as jest.Mock;
const mockLoadTokens = loadTokens as jest.Mock;
const mockSaveTokens = saveTokens as jest.Mock;
const mockClearTokens = clearTokens as jest.Mock;

type UrlEventHandler = (event: { url: string }) => void;

interface LinkingMockState {
  handler: UrlEventHandler | null;
  removeCount: number;
}

const linkingMock: LinkingMockState = { handler: null, removeCount: 0 };

jest.spyOn(Linking, 'addEventListener').mockImplementation((type, handler) => {
  if (type === 'url') {
    linkingMock.handler = handler as UrlEventHandler;
  }
  return {
    remove: () => {
      linkingMock.removeCount += 1;
      linkingMock.handler = null;
    },
  } as ReturnType<typeof Linking.addEventListener>;
});

function fireRedirect(url: string): void {
  if (!linkingMock.handler) throw new Error('Linking listener was not registered');
  linkingMock.handler({ url });
}

/** Returns a Promise + a resolver that lets a test control when openBrowserAsync settles. */
function deferredBrowserResult() {
  let resolveFn: (value: { type: 'dismiss' | 'cancel' }) => void = () => {};
  const promise = new Promise<{ type: 'dismiss' | 'cancel' }>((resolve) => {
    resolveFn = resolve;
  });
  return { promise, resolveFn };
}

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
  linkingMock.handler = null;
  linkingMock.removeCount = 0;
  mockDismissBrowser.mockResolvedValue(undefined);
});

describe('authorizeWithStrava', () => {
  it('exchanges code for tokens and saves them when the Linking listener fires', async () => {
    const browser = deferredBrowserResult();
    mockOpenBrowser.mockReturnValue(browser.promise);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    });
    mockSaveTokens.mockResolvedValue(undefined);

    const pending = authorizeWithStrava();
    // Simulate iOS dispatching the deep-link callback from Strava's 302.
    fireRedirect('omnibike://localhost/oauth/callback?code=auth-code-123&scope=read');
    const result = await pending;

    expect(result.accessToken).toBe('new-access');
    expect(result.athlete.firstName).toBe('Jane');
    expect(mockSaveTokens).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-access' }));
    expect(mockDismissBrowser).toHaveBeenCalledTimes(1);
    expect(linkingMock.removeCount).toBe(1);
  });

  it('throws when user closes the Safari sheet before redirecting back', async () => {
    mockOpenBrowser.mockResolvedValue({ type: 'cancel' });

    await expect(authorizeWithStrava()).rejects.toThrow('cancelled or failed');
    expect(linkingMock.removeCount).toBe(1);
    expect(mockDismissBrowser).not.toHaveBeenCalled();
  });

  it('throws when the redirect URL has no code', async () => {
    const browser = deferredBrowserResult();
    mockOpenBrowser.mockReturnValue(browser.promise);

    const pending = authorizeWithStrava();
    fireRedirect('omnibike://localhost/oauth/callback?error=access_denied');

    await expect(pending).rejects.toThrow('access_denied');
    expect(linkingMock.removeCount).toBe(1);
  });

  it('throws when token exchange HTTP request fails', async () => {
    const browser = deferredBrowserResult();
    mockOpenBrowser.mockReturnValue(browser.promise);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });

    const pending = authorizeWithStrava();
    fireRedirect('omnibike://localhost/oauth/callback?code=code-123');

    await expect(pending).rejects.toThrow('401');
  });

  it('ignores deep links that do not match the Strava redirect URI', async () => {
    const browser = deferredBrowserResult();
    mockOpenBrowser.mockReturnValue(browser.promise);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    });
    mockSaveTokens.mockResolvedValue(undefined);

    const pending = authorizeWithStrava();
    // Unrelated deep link (e.g. provider-gear-link) must not resolve the auth flow.
    fireRedirect('omnibike://provider-gear-link?result=ok');
    // Now fire the real callback.
    fireRedirect('omnibike://localhost/oauth/callback?code=auth-code-999');

    const result = await pending;
    expect(result.accessToken).toBe('new-access');
  });

  it('deduplicates concurrent calls to authorizeWithStrava', async () => {
    const browser = deferredBrowserResult();
    mockOpenBrowser.mockReturnValue(browser.promise);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    });
    mockSaveTokens.mockResolvedValue(undefined);

    const [a, b] = [authorizeWithStrava(), authorizeWithStrava()];
    fireRedirect('omnibike://localhost/oauth/callback?code=shared-code');

    const [resultA, resultB] = await Promise.all([a, b]);
    expect(resultA).toBe(resultB);
    // Only one Safari sheet should have been opened for both callers.
    expect(mockOpenBrowser).toHaveBeenCalledTimes(1);
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

  it('issues only one refresh request when called concurrently with an expired token', async () => {
    const expiredTokens: StravaTokens = { ...SAMPLE_TOKENS, expiresAt: Math.floor(Date.now() / 1000) - 60 };
    mockLoadTokens.mockResolvedValue(expiredTokens);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    });
    mockSaveTokens.mockResolvedValue(undefined);

    const [token1, token2] = await Promise.all([getValidAccessToken(), getValidAccessToken()]);

    expect(token1).toBe('new-access');
    expect(token2).toBe('new-access');
    // Both callers share one refresh — fetch should be called exactly once.
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
