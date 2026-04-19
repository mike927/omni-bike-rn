import { useEffect, useState } from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '../src/services/db/migrations';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { getSQLiteDatabase } from '../src/services/db/database';
import { registerExportProviders } from '../src/services/export/registerExportProviders';
import { ActionButton } from '../src/ui/components/ActionButton';
import { AppScreen } from '../src/ui/layout/AppScreen';
import { palette } from '../src/ui/theme';
import { useSavedGearStore } from '../src/store/savedGearStore';
import { useAppPreferencesStore } from '../src/store/appPreferencesStore';
import { useProviderGearLinkStore } from '../src/store/providerGearLinkStore';
import { useStravaConnectionStore } from '../src/store/stravaConnectionStore';
import { useAppleHealthConnectionStore } from '../src/store/appleHealthConnectionStore';
import { useWatchHr } from '../src/features/gear/hooks/useWatchHr';
import { useInterruptedSessionRecovery } from '../src/features/training/hooks/useInterruptedSessionRecovery';
import { useKeepAwakeDuringTraining } from '../src/features/training/hooks/useKeepAwakeDuringTraining';
import { useTrainingSessionPersistence } from '../src/features/training/hooks/useTrainingSessionPersistence';

export function getOnboardingGateRedirect(segments: readonly string[], onboardingCompleted: boolean): string | null {
  const isOnboardingRoute = segments[0] === 'onboarding';

  if (!onboardingCompleted && !isOnboardingRoute) {
    return '/onboarding';
  }

  if (onboardingCompleted && isOnboardingRoute) {
    return '/';
  }

  return null;
}

export default function RootLayout() {
  const segments = useSegments();
  const hydrateGear = useSavedGearStore((s) => s.hydrate);

  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDrizzleStudio(getSQLiteDatabase());
  }

  const hydratePrefs = useAppPreferencesStore((s) => s.hydrate);
  const prefsHydrated = useAppPreferencesStore((s) => s.hydrated);
  const onboardingCompleted = useAppPreferencesStore((s) => s.onboardingCompleted);
  const hydrateProviderGearLinks = useProviderGearLinkStore((s) => s.hydrate);
  const providerGearLinksHydrated = useProviderGearLinkStore((s) => s.hydrated);
  const hydrateStrava = useStravaConnectionStore((s) => s.hydrate);
  const stravaHydrated = useStravaConnectionStore((s) => s.hydrated);
  const hydrateAppleHealth = useAppleHealthConnectionStore((s) => s.hydrate);
  const appleHealthHydrated = useAppleHealthConnectionStore((s) => s.hydrated);

  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [isDatabaseError, setIsDatabaseError] = useState(false);
  const [databaseInitAttempt, setDatabaseInitAttempt] = useState(0);

  useWatchHr();
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
  }, [hydrateGear, hydratePrefs, hydrateProviderGearLinks, hydrateStrava, hydrateAppleHealth]);

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
        console.error('[RootLayout] Failed to initialize database:', error);
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
    return (
      <>
        <StatusBar style="light" />
        <AppScreen title="Unable to open local data" subtitle="Workout storage could not be initialized.">
          <View style={styles.errorState}>
            <Text style={styles.errorBody}>
              Retry to initialize local storage again. If this keeps failing, restart the app and try once more.
            </Text>
            <ActionButton
              label="Retry"
              onPress={() => {
                setDatabaseInitAttempt((currentAttempt) => currentAttempt + 1);
              }}
            />
          </View>
        </AppScreen>
      </>
    );
  }

  if (!isDatabaseReady || !prefsHydrated || !providerGearLinksHydrated || !stravaHydrated || !appleHealthHydrated) {
    return (
      <>
        <StatusBar style="light" />
        <AppScreen title="Opening Omni Bike" subtitle="Preparing your local data and saved preferences.">
          <View style={styles.loadingState}>
            <Text style={styles.loadingBody}>Loading app state...</Text>
          </View>
        </AppScreen>
      </>
    );
  }

  const onboardingRedirect = getOnboardingGateRedirect(segments, onboardingCompleted);

  if (onboardingRedirect) {
    return (
      <>
        <StatusBar style="light" />
        <Redirect href={onboardingRedirect} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: palette.text,
          },
          headerTintColor: palette.surface,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: palette.background,
          },
        }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="training" options={{ title: 'Training' }} />
        <Stack.Screen name="summary" options={{ title: 'Summary' }} />
        <Stack.Screen name="gear-setup" options={{ title: 'Select Device' }} />
        <Stack.Screen
          name="provider-gear-link"
          options={{
            title: 'Link Provider Bike',
            headerBackTitle: 'Settings',
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  errorState: {
    gap: 16,
  },
  loadingState: {
    gap: 16,
  },
  errorBody: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  loadingBody: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
