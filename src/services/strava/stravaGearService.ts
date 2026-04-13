import type { GearType } from '../../types/gear';
import type { ProviderGearSummary } from '../../types/providerGear';
import { getValidAccessToken } from './stravaAuthService';
import { STRAVA_API_URL } from './stravaConstants';
import type { StravaDetailedAthleteResponse } from './types';

const STRAVA_PROVIDER_ID = 'strava';
const ATTACH_GEAR_RETRY_DELAYS_MS = [1500, 3000];

function logStravaGearRequest(message: string, payload: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }

  console.warn(`[stravaGearService] ${message}`, payload);
}

function mapGearTypeToStravaField(gearType: GearType): 'bikes' {
  switch (gearType) {
    case 'bike':
      return 'bikes';
    default:
      throw new Error(`[stravaGearService] Unsupported gear type: "${gearType}".`);
  }
}

async function fetchAuthenticatedAthlete(accessToken: string): Promise<StravaDetailedAthleteResponse> {
  const response = await fetch(`${STRAVA_API_URL}/athlete`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new Error('Reconnect Strava to refresh bike-linking permissions.');
    }

    throw new Error(`[stravaGearService] Failed to load athlete gear (${response.status}): ${text}`);
  }

  return (await response.json()) as StravaDetailedAthleteResponse;
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function isActivityNotFoundResponse(status: number, responseText: string): boolean {
  if (status !== 404) {
    return false;
  }

  return responseText.includes('"resource":"Activity"') && responseText.toLowerCase().includes('not found');
}

export async function listStravaGear(gearType: GearType): Promise<ProviderGearSummary[]> {
  const accessToken = await getValidAccessToken();
  logStravaGearRequest('Loading provider gear', {
    url: `${STRAVA_API_URL}/athlete`,
    method: 'GET',
    gearType,
  });
  const athlete = await fetchAuthenticatedAthlete(accessToken);
  const field = mapGearTypeToStravaField(gearType);
  const items = athlete[field] ?? [];

  return items.map((item) => ({
    providerId: STRAVA_PROVIDER_ID,
    gearType,
    id: item.id,
    name: item.name,
    isPrimary: item.primary,
  }));
}

export async function attachStravaGearToActivity(activityId: string, providerGearId: string): Promise<void> {
  const accessToken = await getValidAccessToken();

  for (let attempt = 0; attempt <= ATTACH_GEAR_RETRY_DELAYS_MS.length; attempt++) {
    logStravaGearRequest('Attaching gear to Strava activity', {
      url: `${STRAVA_API_URL}/activities/${activityId}`,
      method: 'PUT',
      activityId,
      providerGearId,
      attempt: attempt + 1,
    });

    const response = await fetch(`${STRAVA_API_URL}/activities/${activityId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gear_id: providerGearId }),
    });

    if (response.ok) {
      logStravaGearRequest('Attached gear to Strava activity', {
        activityId,
        providerGearId,
        attempt: attempt + 1,
      });
      return;
    }

    const text = await readResponseText(response);

    logStravaGearRequest('Strava gear attach failed', {
      activityId,
      providerGearId,
      attempt: attempt + 1,
      status: response.status,
      responseText: text,
    });

    if (isActivityNotFoundResponse(response.status, text) && attempt < ATTACH_GEAR_RETRY_DELAYS_MS.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ATTACH_GEAR_RETRY_DELAYS_MS[attempt]);
      });
      continue;
    }

    if (response.status === 401 || response.status === 403 || isActivityNotFoundResponse(response.status, text)) {
      throw new Error(
        `[stravaGearService] Failed to attach gear to activity (${response.status}): ${text} Reconnect Strava to grant private activity edit access.`,
      );
    }

    throw new Error(`[stravaGearService] Failed to attach gear to activity (${response.status}): ${text}`);
  }
}

export async function clearStravaGearFromActivity(activityId: string): Promise<void> {
  await attachStravaGearToActivity(activityId, 'none');
}
