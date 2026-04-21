export const STRAVA_PROVIDER_ID = 'strava' as const;
export const APPLE_HEALTH_PROVIDER_ID = 'apple_health' as const;

export type KnownProviderId = typeof STRAVA_PROVIDER_ID | typeof APPLE_HEALTH_PROVIDER_ID;

export const KNOWN_PROVIDER_DISPLAY_ORDER: readonly KnownProviderId[] = [STRAVA_PROVIDER_ID, APPLE_HEALTH_PROVIDER_ID];
