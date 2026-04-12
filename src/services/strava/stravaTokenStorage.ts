import * as SecureStore from 'expo-secure-store';

import {
  SECURE_STORE_ACCESS_TOKEN_KEY,
  SECURE_STORE_ATHLETE_KEY,
  SECURE_STORE_EXPIRES_AT_KEY,
  SECURE_STORE_REFRESH_TOKEN_KEY,
} from './stravaConstants';
import type { StravaTokens } from './types';

export async function saveTokens(tokens: StravaTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(SECURE_STORE_EXPIRES_AT_KEY, String(tokens.expiresAt)),
    SecureStore.setItemAsync(SECURE_STORE_ATHLETE_KEY, JSON.stringify(tokens.athlete)),
  ]);
}

export async function loadTokens(): Promise<StravaTokens | null> {
  const [accessToken, refreshToken, expiresAtRaw, athleteRaw] = await Promise.all([
    SecureStore.getItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(SECURE_STORE_EXPIRES_AT_KEY),
    SecureStore.getItemAsync(SECURE_STORE_ATHLETE_KEY),
  ]);

  if (!accessToken || !refreshToken || !expiresAtRaw || !athleteRaw) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }

  try {
    const athlete = JSON.parse(athleteRaw) as StravaTokens['athlete'];
    return { accessToken, refreshToken, expiresAt, athlete };
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(SECURE_STORE_EXPIRES_AT_KEY),
    SecureStore.deleteItemAsync(SECURE_STORE_ATHLETE_KEY),
  ]);
}
