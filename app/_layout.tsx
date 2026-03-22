import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { palette } from '../src/ui/theme';

export default function RootLayout() {
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
      </Stack>
    </>
  );
}
