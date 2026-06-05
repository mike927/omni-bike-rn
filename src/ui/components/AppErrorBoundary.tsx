import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../layout/AppScreen';
import { noir } from '../theme';
import { ActionButton } from './ActionButton';

/**
 * App-wide fallback rendered by Expo Router when a route subtree throws during
 * render or a synchronous effect. Exported as `ErrorBoundary` from
 * app/_layout.tsx so it wraps every screen — without it, a single uncaught
 * render error white-screens the entire app with no way to recover.
 */
export function AppErrorBoundary({ error, retry }: Readonly<ErrorBoundaryProps>) {
  return (
    <>
      <StatusBar style="light" />
      <AppScreen title="Something went wrong" subtitle="The app ran into an unexpected error.">
        <View style={styles.body}>
          <Text style={styles.message}>You can try again. If this keeps happening, restart the app.</Text>
          {__DEV__ ? <Text style={styles.devDetail}>{error.message}</Text> : null}
          <ActionButton label="Try again" onPress={retry} scheme="noir" />
        </View>
      </AppScreen>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
  },
  message: {
    color: noir.ink2,
    fontSize: 15,
    lineHeight: 22,
  },
  devDetail: {
    color: noir.dangerSoft,
    fontSize: 13,
    lineHeight: 18,
  },
});
