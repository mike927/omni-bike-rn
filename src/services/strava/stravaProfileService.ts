import type { BiologicalSex } from '../../types/userProfile';
import { getValidAccessToken } from './stravaAuthService';
import { STRAVA_API_URL } from './stravaConstants';
import type { StravaDetailedAthleteResponse } from './types';

export interface StravaProfilePartial {
  sex?: BiologicalSex;
  weightKg?: number;
}

function logStravaProfileRequest(message: string, payload: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }
  console.warn(`[stravaProfileService] ${message}`, payload);
}

async function fetchAuthenticatedAthlete(accessToken: string): Promise<StravaDetailedAthleteResponse> {
  const response = await fetch(`${STRAVA_API_URL}/athlete`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error('Reconnect Strava to refresh profile read permissions.');
    }
    throw new Error(`[stravaProfileService] Failed to load athlete profile (${response.status}): ${text}`);
  }

  return (await response.json()) as StravaDetailedAthleteResponse;
}

function mapStravaSex(sex: StravaDetailedAthleteResponse['sex']): BiologicalSex | undefined {
  if (sex === 'M') return 'male';
  if (sex === 'F') return 'female';
  return undefined;
}

export async function loadProfileFromStrava(): Promise<StravaProfilePartial> {
  const accessToken = await getValidAccessToken();
  logStravaProfileRequest('Loading athlete profile', { url: `${STRAVA_API_URL}/athlete`, method: 'GET' });
  const athlete = await fetchAuthenticatedAthlete(accessToken);

  const partial: StravaProfilePartial = {};
  const sex = mapStravaSex(athlete.sex);
  if (sex) partial.sex = sex;
  // Strava reports weight in kilograms.
  if (typeof athlete.weight === 'number' && Number.isFinite(athlete.weight) && athlete.weight > 0) {
    partial.weightKg = athlete.weight;
  }
  return partial;
}
