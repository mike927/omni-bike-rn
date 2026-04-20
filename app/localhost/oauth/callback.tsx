import { Redirect } from 'expo-router';

/**
 * Silent handler for Strava's OAuth redirect (`omnibike://localhost/oauth/callback?code=…`).
 *
 * The token exchange is owned by the `Linking.addEventListener` subscription in
 * `src/services/strava/stravaAuthService.ts` — it fires in parallel with this
 * route and does all the work. This file exists solely so expo-router treats
 * the deep link as a known route instead of rendering `+not-found`.
 */
export default function StravaOAuthCallbackRoute() {
  return <Redirect href="/(tabs)/settings" />;
}
