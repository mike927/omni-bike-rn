import Constants from 'expo-constants';

import type { ExpoExtra } from '../../types/config';

const STRAVA_APP_SCHEME = 'omnibike';
const DEFAULT_STRAVA_CALLBACK_DOMAIN = 'localhost';

const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;

const rawClientId = extra?.stravaClientId ?? '';
const rawClientSecret = extra?.stravaClientSecret ?? '';
const rawCallbackDomain = extra?.stravaCallbackDomain?.trim() || DEFAULT_STRAVA_CALLBACK_DOMAIN;

if (!rawClientId || !rawClientSecret) {
  console.warn(
    '[stravaConstants] STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is not set. ' +
      'Register a Strava API app at https://www.strava.com/settings/api and set the ' +
      'environment variables before building.',
  );
}

export const STRAVA_CLIENT_ID = rawClientId;
export const STRAVA_CLIENT_SECRET = rawClientSecret;

export const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
export const STRAVA_API_URL = 'https://www.strava.com/api/v3';
export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
export const STRAVA_UPLOAD_URL = 'https://www.strava.com/api/v3/uploads';
export const STRAVA_DEAUTH_URL = 'https://www.strava.com/oauth/deauthorize';
export const STRAVA_GEAR_SETTINGS_URL = 'https://www.strava.com/settings/gear';

// Strava validates the redirect host against the configured callback domain.
export const STRAVA_REDIRECT_URI = `${STRAVA_APP_SCHEME}://${rawCallbackDomain}/oauth/callback`;

export const STRAVA_SCOPES = 'activity:write,activity:read_all,read,profile:read_all';

export const SECURE_STORE_ACCESS_TOKEN_KEY = 'strava.accessToken';
export const SECURE_STORE_REFRESH_TOKEN_KEY = 'strava.refreshToken';
export const SECURE_STORE_EXPIRES_AT_KEY = 'strava.expiresAt';
export const SECURE_STORE_ATHLETE_KEY = 'strava.athlete';

/** Refresh the access token this many ms before it expires. */
export const TOKEN_EXPIRY_BUFFER_MS = 300_000;

/** Value sent to Strava's PUT /activities/:id to clear any attached gear. */
export const STRAVA_CLEAR_GEAR_ID = '';

/** Substring embedded in errors from stravaGearService that signals a reconnect is required. */
export const STRAVA_RECONNECT_ERROR_MARKER = 'Reconnect Strava';
