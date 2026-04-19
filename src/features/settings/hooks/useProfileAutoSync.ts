import { useEffect, useRef } from 'react';

import { loadProfileFromAppleHealth } from '../../../services/health/appleHealthAdapter';
import { loadProfileFromStrava } from '../../../services/strava/stravaProfileService';
import { useAppleHealthConnectionStore } from '../../../store/appleHealthConnectionStore';
import { useStravaConnectionStore } from '../../../store/stravaConnectionStore';
import { useUserProfileStore } from '../../../store/userProfileStore';

/**
 * Auto-fills the user profile from Apple Health (authoritative) or Strava
 * (fallback when HK is absent) whenever a connection transitions
 * disconnected → connected. Manual edits are preserved by `applyAutoSync`
 * itself — this hook just orchestrates *when* the sync runs.
 *
 * Mount once at the app root, after the relevant stores have hydrated.
 */
export function useProfileAutoSync(): void {
  const profileHydrated = useUserProfileStore((s) => s.hydrated);
  const applyAutoSync = useUserProfileStore((s) => s.applyAutoSync);
  const appleHealthHydrated = useAppleHealthConnectionStore((s) => s.hydrated);
  const appleHealthConnected = useAppleHealthConnectionStore((s) => s.connected);
  const stravaHydrated = useStravaConnectionStore((s) => s.hydrated);
  const stravaConnected = useStravaConnectionStore((s) => s.connected);

  // Track previous connection state so we only sync on a false→true transition
  // (or on the very first run if the user is already connected at launch).
  const prevAppleHealthRef = useRef<boolean | null>(null);
  const prevStravaRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!profileHydrated || !appleHealthHydrated) return;
    const previous = prevAppleHealthRef.current;
    prevAppleHealthRef.current = appleHealthConnected;
    if (!appleHealthConnected) return;
    if (previous === true) return;
    void loadProfileFromAppleHealth()
      .then((partial) => applyAutoSync('apple-health', partial))
      .catch((error: unknown) => {
        console.error('[useProfileAutoSync] Apple Health sync failed:', error);
      });
  }, [profileHydrated, appleHealthHydrated, appleHealthConnected, applyAutoSync]);

  useEffect(() => {
    if (!profileHydrated || !stravaHydrated || !appleHealthHydrated) return;
    const previous = prevStravaRef.current;
    prevStravaRef.current = stravaConnected;
    // Apple Health is authoritative. Skip the Strava seed when HK is connected
    // so a Strava reconnect doesn't overwrite weight/sex that HK already owns.
    if (appleHealthConnected) return;
    if (!stravaConnected) return;
    if (previous === true) return;
    void loadProfileFromStrava()
      .then((partial) => applyAutoSync('strava', partial))
      .catch((error: unknown) => {
        console.error('[useProfileAutoSync] Strava sync failed:', error);
      });
  }, [profileHydrated, stravaHydrated, stravaConnected, appleHealthHydrated, appleHealthConnected, applyAutoSync]);
}
