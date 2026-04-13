/**
 * Typed shape of the `extra` field injected by app.config.ts.
 * Access via `Constants.expoConfig?.extra as ExpoExtra`.
 */
export interface ExpoExtra {
  stravaClientId: string;
  stravaClientSecret: string;
}
