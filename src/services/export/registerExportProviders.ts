import { registerExportProvider } from './exportProviderRegistry';
import { StravaExportProvider } from './StravaExportProvider';

export function registerExportProviders(): void {
  registerExportProvider(new StravaExportProvider());
}
