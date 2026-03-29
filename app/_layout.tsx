import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { initializeDatabase } from '../src/services/db/migrations';
import { palette } from '../src/ui/theme';
import { useSavedGearStore } from '../src/store/savedGearStore';
import { useTrainingSessionPersistence } from '../src/features/training/hooks/useTrainingSessionPersistence';

export default function RootLayout() {
  const hydrate = useSavedGearStore((s) => s.hydrate);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);

  useTrainingSessionPersistence(isDatabaseReady);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    let isMounted = true;

    void initializeDatabase()
      .then(() => {
        if (isMounted) {
          setIsDatabaseReady(true);
        }
      })
      .catch((error: unknown) => {
        console.error('[RootLayout] Failed to initialize database:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isDatabaseReady) {
    return null;
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="training" options={{ title: 'Training' }} />
        <Stack.Screen name="summary" options={{ title: 'Summary' }} />
        <Stack.Screen name="gear-setup" options={{ title: 'Select Device' }} />
      </Stack>
    </>
  );
}
