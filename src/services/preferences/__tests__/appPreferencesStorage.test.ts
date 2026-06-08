import Storage from 'expo-sqlite/kv-store';

import { loadPrimaryHrSource, setPrimaryHrSource } from '../appPreferencesStorage';

jest.mock('expo-sqlite/kv-store', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGetItem = Storage.getItem as jest.Mock;
const mockSetItem = Storage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
});

describe('loadPrimaryHrSource', () => {
  it('returns null when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await loadPrimaryHrSource()).toBeNull();
  });

  it('returns null when the key is absent from stored preferences', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ onboardingCompleted: true }));
    expect(await loadPrimaryHrSource()).toBeNull();
  });

  it('returns "watch" when stored', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ primaryHrSource: 'watch' }));
    expect(await loadPrimaryHrSource()).toBe('watch');
  });

  it('returns "bluetooth" when stored', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ primaryHrSource: 'bluetooth' }));
    expect(await loadPrimaryHrSource()).toBe('bluetooth');
  });

  it('migrates a legacy "bike" value to null (source removed)', async () => {
    // Pre-existing installs may have persisted the now-removed 'bike' source.
    mockGetItem.mockResolvedValue(JSON.stringify({ primaryHrSource: 'bike' }));
    expect(await loadPrimaryHrSource()).toBeNull();
  });

  it('returns null for an unrecognized stored value', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ primaryHrSource: 'garbage' }));
    expect(await loadPrimaryHrSource()).toBeNull();
  });
});

describe('setPrimaryHrSource', () => {
  it('persists "watch" under the canonical key', async () => {
    mockGetItem.mockResolvedValue(null);
    await setPrimaryHrSource('watch');
    const [key, value] = mockSetItem.mock.calls[0] as [string, string];
    expect(key).toBe('omni:appPreferences');
    expect(JSON.parse(value).primaryHrSource).toBe('watch');
  });

  it('persists "bluetooth" under the canonical key', async () => {
    mockGetItem.mockResolvedValue(null);
    await setPrimaryHrSource('bluetooth');
    const [key, value] = mockSetItem.mock.calls[0] as [string, string];
    expect(key).toBe('omni:appPreferences');
    expect(JSON.parse(value).primaryHrSource).toBe('bluetooth');
  });

  it('does not clobber existing preferences when writing', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ onboardingCompleted: true }));
    await setPrimaryHrSource('watch');
    const [, value] = mockSetItem.mock.calls[0] as [string, string];
    const written = JSON.parse(value);
    expect(written.onboardingCompleted).toBe(true);
    expect(written.primaryHrSource).toBe('watch');
  });
});

describe('round-trip', () => {
  it.each(['watch', 'bluetooth'] as const)('round-trips %s correctly', async (source) => {
    let stored: string | null = null;
    mockSetItem.mockImplementation((_key: string, value: string) => {
      stored = value;
      return Promise.resolve();
    });
    mockGetItem.mockImplementation(() => Promise.resolve(stored));

    await setPrimaryHrSource(source);
    expect(await loadPrimaryHrSource()).toBe(source);
  });
});
