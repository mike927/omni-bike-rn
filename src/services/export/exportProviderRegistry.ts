import type { ExportProvider } from './ExportProvider';

const providers = new Map<string, ExportProvider>();

export function registerExportProvider(provider: ExportProvider): void {
  if (providers.has(provider.id)) {
    console.warn(`[exportProviderRegistry] Provider "${provider.id}" already registered, replacing.`);
  }
  providers.set(provider.id, provider);
}

export function getExportProvider(id: string): ExportProvider | undefined {
  return providers.get(id);
}

export function getAllExportProviders(): ExportProvider[] {
  return Array.from(providers.values());
}

export function clearExportProvidersForTests(): void {
  providers.clear();
}
