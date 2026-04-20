import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import {
  STRAVA_AUTH_URL,
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_DEAUTH_URL,
  STRAVA_REDIRECT_URI,
  STRAVA_SCOPES,
  STRAVA_TOKEN_URL,
  TOKEN_EXPIRY_BUFFER_MS,
} from './stravaConstants';
import { clearTokens, loadTokens, saveTokens } from './stravaTokenStorage';
import type { StravaAthlete, StravaTokenResponse, StravaTokens } from './types';

/** Promise-based mutex to prevent concurrent token refreshes. */
let refreshPromise: Promise<StravaTokens> | null = null;

/** Promise-based mutex to prevent concurrent authorization flows (e.g. double-tap). */
let authorizePromise: Promise<StravaTokens> | null = null;

function parseAthleteFromResponse(raw: StravaTokenResponse['athlete']): StravaAthlete {
  return {
    id: raw?.id ?? 0,
    firstName: raw?.firstname ?? '',
    lastName: raw?.lastname ?? '',
  };
}

async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[stravaAuthService] Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as StravaTokenResponse;
  const tokens: StravaTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athlete: parseAthleteFromResponse(data.athlete),
  };
  await saveTokens(tokens);
  return tokens;
}

export async function authorizeWithStrava(): Promise<StravaTokens> {
  authorizePromise ??= runAuthorize().finally(() => {
    authorizePromise = null;
  });
  return authorizePromise;
}

async function runAuthorize(): Promise<StravaTokens> {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
  });
  const authUrl = `${STRAVA_AUTH_URL}?${params.toString()}`;

  const code = await awaitRedirectCode(authUrl);
  return exchangeCodeForTokens(code);
}

/**
 * Opens Strava's authorize page in an in-app Safari sheet and resolves with the
 * authorization code when iOS dispatches the `omnibike://` deep-link callback.
 *
 * Why `openBrowserAsync` + `Linking` instead of `openAuthSessionAsync`:
 * the latter wraps `ASWebAuthenticationSession`, which hangs on
 * `accounts.google.com` during Strava's post-consent redirect chain for
 * Google-linked accounts. `SFSafariViewController` behaves as standard Safari
 * to Google's auth flow and completes the handshake correctly.
 */
async function awaitRedirectCode(authUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (settled || !url.startsWith(STRAVA_REDIRECT_URI)) return;
      settled = true;
      subscription.remove();
      void WebBrowser.dismissBrowser();

      const parsed = new URL(url);
      const returnedCode = parsed.searchParams.get('code');
      if (returnedCode) {
        resolve(returnedCode);
      } else {
        const error = parsed.searchParams.get('error') ?? 'unknown';
        reject(new Error(`[stravaAuthService] No authorization code returned. Strava error: ${error}`));
      }
    });

    WebBrowser.openBrowserAsync(authUrl)
      .then(() => {
        if (settled) return;
        settled = true;
        subscription.remove();
        reject(new Error('[stravaAuthService] Strava authorization was cancelled or failed.'));
      })
      .catch((err: unknown) => {
        if (settled) return;
        settled = true;
        subscription.remove();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

export async function refreshAccessToken(): Promise<StravaTokens> {
  const stored = await loadTokens();
  if (!stored) {
    throw new Error('[stravaAuthService] Cannot refresh — no tokens stored.');
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: stored.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[stravaAuthService] Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as StravaTokenResponse;
  const tokens: StravaTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athlete: stored.athlete,
  };
  await saveTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string> {
  const stored = await loadTokens();
  if (!stored) {
    throw new Error('[stravaAuthService] Not connected to Strava.');
  }

  const nowMs = Date.now();
  const expiresAtMs = stored.expiresAt * 1000;
  if (nowMs < expiresAtMs - TOKEN_EXPIRY_BUFFER_MS) {
    return stored.accessToken;
  }

  // Deduplicate concurrent refresh calls.
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });

  const refreshed = await refreshPromise;
  return refreshed.accessToken;
}

export async function disconnectStrava(): Promise<void> {
  const stored = await loadTokens();
  if (stored) {
    try {
      await fetch(STRAVA_DEAUTH_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored.accessToken}` },
      });
    } catch (err: unknown) {
      console.error('[stravaAuthService] Deauth request failed (continuing with local clear):', err);
    }
  }
  await clearTokens();
}

export async function isStravaConnected(): Promise<boolean> {
  const tokens = await loadTokens();
  return tokens !== null;
}

export async function getConnectedAthlete(): Promise<StravaAthlete | null> {
  const tokens = await loadTokens();
  return tokens?.athlete ?? null;
}
