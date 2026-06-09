import { registerExportProviders } from '../registerExportProviders';
import { getExportProvider, clearExportProvidersForTests } from '../exportProviderRegistry';

jest.mock('../StravaExportProvider', () => ({
  StravaExportProvider: jest.fn().mockImplementation(() => ({
    id: 'strava',
    name: 'Strava',
    isConfigured: () => false,
    exportSession: jest.fn(),
  })),
}));

jest.mock('../AppleHealthExportProvider', () => ({
  AppleHealthExportProvider: jest.fn().mockImplementation(() => ({
    id: 'apple_health',
    name: 'Apple Health',
    isConfigured: () => false,
    exportSession: jest.fn(),
  })),
}));

describe('registerExportProviders', () => {
  beforeEach(() => clearExportProvidersForTests());

  it('always registers Strava', () => {
    registerExportProviders({ appleHealthSupported: false });
    expect(getExportProvider('strava')).toBeDefined();
  });
  it('registers Apple Health when supported (iOS)', () => {
    registerExportProviders({ appleHealthSupported: true });
    expect(getExportProvider('apple_health')).toBeDefined();
  });
  it('omits Apple Health when unsupported (Android)', () => {
    registerExportProviders({ appleHealthSupported: false });
    expect(getExportProvider('apple_health')).toBeUndefined();
  });
});
