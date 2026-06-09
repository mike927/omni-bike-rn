import { Platform } from 'react-native';

/**
 * Apple Health (HealthKit) exists only on iOS. Single source of truth for gating
 * Apple-Health UI and the Apple Health export provider so nothing dead-ends on
 * Android. Mirrors `isAppleWatchAvailable`.
 */
export function isAppleHealthSupported(platformOs: string = Platform.OS): boolean {
  return platformOs === 'ios';
}
