import Storage from 'expo-sqlite/kv-store';

import {
  clearProviderGearLinks,
  getProviderGearLink,
  loadProviderGearLinks,
  markProviderGearLinkStale,
  removeProviderGearLink,
  saveProviderGearLink,
} from '../providerGearLinkStorage';
import type { LinkedProviderGear } from '../../../types/providerGear';

jest.mock('expo-sqlite/kv-store', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetItem = Storage.getItem as jest.Mock;
const mockSetItem = Storage.setItem as jest.Mock;
const mockRemoveItem = Storage.removeItem as jest.Mock;

const BASE_LINK: LinkedProviderGear = {
  providerId: 'strava',
  localGearId: 'bike-1',
  localGearType: 'bike',
  providerGearId: 'gear-1',
  providerGearName: 'Rave',
  providerGearType: 'bike',
  stale: false,
  lastSyncedAtMs: 123,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);
});

describe('providerGearLinkStorage', () => {
  it('returns an empty list when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);

    await expect(loadProviderGearLinks()).resolves.toEqual([]);
  });

  it('saves a provider gear link', async () => {
    mockGetItem.mockResolvedValue(null);

    await saveProviderGearLink(BASE_LINK);

    expect(mockSetItem).toHaveBeenCalledWith('omni:providerGearLinks', JSON.stringify([BASE_LINK]));
  });

  it('overwrites an existing link for the same provider and local gear', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify([
        BASE_LINK,
        {
          ...BASE_LINK,
          providerId: 'other',
          providerGearId: 'gear-2',
        },
      ]),
    );

    await saveProviderGearLink({
      ...BASE_LINK,
      providerGearId: 'gear-9',
      providerGearName: 'Rave 2',
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      'omni:providerGearLinks',
      JSON.stringify([
        {
          ...BASE_LINK,
          providerId: 'other',
          providerGearId: 'gear-2',
        },
        { ...BASE_LINK, providerGearId: 'gear-9', providerGearName: 'Rave 2' },
      ]),
    );
  });

  it('returns a specific link when present', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([BASE_LINK]));

    await expect(getProviderGearLink('strava', 'bike-1', 'bike')).resolves.toEqual(BASE_LINK);
  });

  it('marks a stored link as stale', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([BASE_LINK]));

    await markProviderGearLinkStale('strava', 'bike-1', 'bike');

    expect(mockSetItem).toHaveBeenCalledWith('omni:providerGearLinks', JSON.stringify([{ ...BASE_LINK, stale: true }]));
  });

  it('removes a stored link', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([BASE_LINK]));

    await removeProviderGearLink('strava', 'bike-1', 'bike');

    expect(mockSetItem).toHaveBeenCalledWith('omni:providerGearLinks', JSON.stringify([]));
  });

  it('clears all provider gear links', async () => {
    await clearProviderGearLinks();

    expect(mockRemoveItem).toHaveBeenCalledWith('omni:providerGearLinks');
  });
});
