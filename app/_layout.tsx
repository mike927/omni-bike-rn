import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '../src/services/db/migrations';
import { ActionButton } from '../src/ui/components/ActionButton';
import { AppScreen } from '../src/ui/layout/AppScreen';
import { palette } from '../src/ui/theme';
import { useSavedGearStore } from '../src/store/savedGearStore';
import { useTrainingSessionPersistence } from '../src/features/training/hooks/useTrainingSessionPersistence';

export default function RootLayout() {
  const hydrate = useSavedGearStore((s) => s.hydrate);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [isDatabaseError, setIsDatabaseError] = useState(false);
  const [databaseInitAttempt, setDatabaseInitAttempt] = useState(0);

  useTrainingSessionPersistence(isDatabaseReady);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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

const styles = StyleSheet.create({
  errorState: {
    gap: 16,
  },
  errorBody: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
