import { useEffect, useState } from 'react';

import { initializeDatabase } from '../services/db/migrations';
import { registerExportProviders } from '../services/export/registerExportProviders';
import { useSavedGearStore } from '../store/savedGearStore';
import { useAppPreferencesStore } from '../store/appPreferencesStore';
import { useProviderGearLinkStore } from '../store/providerGearLinkStore';
import { useStravaConnectionStore } from '../store/stravaConnectionStore';
import { useAppleHealthConnectionStore } from '../store/appleHealthConnectionStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useAppleHealthPermissionsRefresh } from '../features/integrations/hooks/useAppleHealthPermissionsRefresh';
import { useWatchHr } from '../features/gear/hooks/useWatchHr';
import { useInterruptedSessionRecovery } from '../features/training/hooks/useInterruptedSessionRecovery';
import { useKeepAwakeDuringTraining } from '../features/training/hooks/useKeepAwakeDuringTraining';
import { useTrainingSessionPersistence } from '../features/training/hooks/useTrainingSessionPersistence';

/** Boot status the root layout renders against. */
export type AppInitState =
  | { phase: 'loading' }
  | { phase: 'error'; retry: () => void }
  | { phase: 'ready'; onboardingCompleted: boolean };

/**
 * Owns app boot: store hydration + provider registration, database init with
 * retry, and the global lifecycle hooks. The root layout consumes the returned
 * {@link AppInitState} and renders accordingly.
 */
export function useAppInitialization(): AppInitState {
  const hydrateGear = useSavedGearStore((s) => s.hydrate);
  const hydratePrefs = useAppPreferencesStore((s) => s.hydrate);
  const prefsHydrated = useAppPreferencesStore((s) => s.hydrated);
  const onboardingCompleted = useAppPreferencesStore((s) => s.onboardingCompleted);
  const hydrateProviderGearLinks = useProviderGearLinkStore((s) => s.hydrate);
  const providerGearLinksHydrated = useProviderGearLinkStore((s) => s.hydrated);
  const hydrateStrava = useStravaConnectionStore((s) => s.hydrate);
  const stravaHydrated = useStravaConnectionStore((s) => s.hydrated);
  const hydrateAppleHealth = useAppleHealthConnectionStore((s) => s.hydrate);
  const appleHealthHydrated = useAppleHealthConnectionStore((s) => s.hydrated);
  const hydrateUserProfile = useUserProfileStore((s) => s.hydrate);
  const userProfileHydrated = useUserProfileStore((s) => s.hydrated);

  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [isDatabaseError, setIsDatabaseError] = useState(false);
  const [databaseInitAttempt, setDatabaseInitAttempt] = useState(0);

  useWatchHr();
  useAppleHealthPermissionsRefresh();
  useKeepAwakeDuringTraining();
  useTrainingSessionPersistence(isDatabaseReady);
  useInterruptedSessionRecovery(isDatabaseReady && onboardingCompleted);

  useEffect(() => {
    registerExportProviders();
    void hydrateGear();
    void hydratePrefs();
    void hydrateProviderGearLinks();
    void hydrateStrava();
    void hydrateAppleHealth();
    void hydrateUserProfile();
  }, [hydrateGear, hydratePrefs, hydrateProviderGearLinks, hydrateStrava, hydrateAppleHealth, hydrateUserProfile]);

  useEffect(() => {
    let isMounted = true;

    setIsDatabaseError(false);

    void initializeDatabase()
      .then(() => {
        if (isMounted) {
          setIsDatabaseError(false);
          setIsDatabaseReady(true);
        }
      })
      .catch((error: unknown) => {
        console.error('[useAppInitialization] Failed to initialize database:', error);
        if (isMounted) {
          setIsDatabaseReady(false);
          setIsDatabaseError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [databaseInitAttempt]);

  if (isDatabaseError) {
    return { phase: 'error', retry: () => setDatabaseInitAttempt((attempt) => attempt + 1) };
  }

  if (
    !isDatabaseReady ||
    !prefsHydrated ||
    !providerGearLinksHydrated ||
    !stravaHydrated ||
    !appleHealthHydrated ||
    !userProfileHydrated
  ) {
    return { phase: 'loading' };
  }

  return { phase: 'ready', onboardingCompleted };
}
