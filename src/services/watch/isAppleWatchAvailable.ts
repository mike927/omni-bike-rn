import { Platform } from 'react-native';

export function isAppleWatchAvailable(platformOs: string = Platform.OS, isPad?: boolean): boolean {
  const resolvedIsPad = isPad ?? ('isPad' in Platform ? Platform.isPad === true : false);
  return platformOs === 'ios' && !resolvedIsPad;
}
