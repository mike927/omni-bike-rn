import { Platform } from 'react-native';

/**
 * Apple Health (HealthKit) exists only on iOS. Single source of truth for gating
 * Apple-Health UI and the Apple Health export provider so nothing dead-ends on
 * Android. Mirrors `isAppleWatchAvailable`. Unlike `isAppleWatchAvailable`, iPads
 * are intentionally NOT excluded here because HealthKit is available on iPad
 * (whereas the Watch companion is not).
 */
export function isAppleHealthSupported(platformOs: string = Platform.OS): boolean {
  return platformOs === 'ios';
}
