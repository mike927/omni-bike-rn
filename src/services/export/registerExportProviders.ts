import { AppleHealthExportProvider } from './AppleHealthExportProvider';
import { registerExportProvider } from './exportProviderRegistry';
import { StravaExportProvider } from './StravaExportProvider';
import { isAppleHealthSupported } from '../health/isAppleHealthSupported';

interface RegisterExportProvidersOptions {
  /** Defaults to platform support; injectable for tests. */
  readonly appleHealthSupported?: boolean;
}

export function registerExportProviders(options: RegisterExportProvidersOptions = {}): void {
  const { appleHealthSupported = isAppleHealthSupported() } = options;

  registerExportProvider(new StravaExportProvider());
  if (appleHealthSupported) {
    registerExportProvider(new AppleHealthExportProvider());
  }
}
