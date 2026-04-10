import type { ExportProvider } from '../ExportProvider';
import {
  clearExportProvidersForTests,
  getAllExportProviders,
  getExportProvider,
  registerExportProvider,
} from '../exportProviderRegistry';

function createMockProvider(id: string, name: string, configured = false): ExportProvider {
  return {
    id,
    name,
    isConfigured: () => configured,
    exportSession: jest.fn().mockResolvedValue({ success: true }),
  };
}

describe('exportProviderRegistry', () => {
  afterEach(() => {
    clearExportProvidersForTests();
  });

  it('registers and retrieves a provider by id', () => {
    const provider = createMockProvider('strava', 'Strava');

    registerExportProvider(provider);

    expect(getExportProvider('strava')).toBe(provider);
  });

  it('returns undefined for an unregistered provider', () => {
    expect(getExportProvider('unknown')).toBeUndefined();
  });

  it('returns all registered providers', () => {
    const strava = createMockProvider('strava', 'Strava');
    const garmin = createMockProvider('garmin', 'Garmin');

    registerExportProvider(strava);
    registerExportProvider(garmin);

    expect(getAllExportProviders()).toEqual([strava, garmin]);
  });

  it('replaces a provider when registering with the same id', () => {
    const original = createMockProvider('strava', 'Strava v1');
    const replacement = createMockProvider('strava', 'Strava v2');

    registerExportProvider(original);
    registerExportProvider(replacement);

    expect(getExportProvider('strava')).toBe(replacement);
    expect(getAllExportProviders()).toHaveLength(1);
  });

  it('clears all providers for tests', () => {
    registerExportProvider(createMockProvider('strava', 'Strava'));
    registerExportProvider(createMockProvider('garmin', 'Garmin'));

    clearExportProvidersForTests();

    expect(getAllExportProviders()).toHaveLength(0);
  });
});
