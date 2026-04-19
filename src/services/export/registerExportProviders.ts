import { AppleHealthExportProvider } from './AppleHealthExportProvider';
import { registerExportProvider } from './exportProviderRegistry';
import { StravaExportProvider } from './StravaExportProvider';

export function registerExportProviders(): void {
  registerExportProvider(new StravaExportProvider());
  registerExportProvider(new AppleHealthExportProvider());
}
