import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { palette } from '../src/ui/theme';
import { useSavedGearStore } from '../src/store/savedGearStore';

export default function RootLayout() {
  const hydrate = useSavedGearStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
