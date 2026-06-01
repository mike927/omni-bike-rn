import { useProviderGearLinkStore } from '../providerGearLinkStore';
import {
  loadProviderGearLinks,
  markProviderGearLinkStale,
  removeProviderGearLink,
  removeProviderGearLinksForProvider,
  saveProviderGearLink,
} from '../../services/providerGear/providerGearLinkStorage';
import type { LinkedProviderGear } from '../../types/providerGear';

jest.mock('../../services/providerGear/providerGearLinkStorage', () => ({
  loadProviderGearLinks: jest.fn(),
  saveProviderGearLink: jest.fn(),
  removeProviderGearLink: jest.fn(),
  markProviderGearLinkStale: jest.fn(),
  removeProviderGearLinksForProvider: jest.fn(),
  clearProviderGearLinks: jest.fn(),
}));

const mockLoad = loadProviderGearLinks as jest.Mock;
const mockSave = saveProviderGearLink as jest.Mock;
const mockRemove = removeProviderGearLink as jest.Mock;
const mockMarkStale = markProviderGearLinkStale as jest.Mock;
const mockRemoveForProvider = removeProviderGearLinksForProvider as jest.Mock;

const LINK: LinkedProviderGear = {
  providerId: 'strava',
  localGearId: 'bike-1',
  localGearType: 'bike',
  providerGearId: 'gear-1',
  providerGearName: 'Rave',
  providerGearType: 'bike',
  stale: false,
  lastSyncedAtMs: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  useProviderGearLinkStore.setState({ links: [], hydrated: false });
  mockSave.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  mockMarkStale.mockResolvedValue(undefined);
  mockRemoveForProvider.mockResolvedValue(undefined);
});

describe('useProviderGearLinkStore', () => {
  it('hydrates links from storage once', async () => {
    mockLoad.mockResolvedValue([LINK]);
    await useProviderGearLinkStore.getState().hydrate();
    expect(useProviderGearLinkStore.getState().links).toEqual([LINK]);
    expect(useProviderGearLinkStore.getState().hydrated).toBe(true);
    await useProviderGearLinkStore.getState().hydrate();
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('upsertLink persists then re-derives links from storage', async () => {
    mockLoad.mockResolvedValue([LINK]);
    await useProviderGearLinkStore.getState().upsertLink(LINK);
    expect(mockSave).toHaveBeenCalledWith(LINK);
    expect(mockLoad).toHaveBeenCalled();
    expect(useProviderGearLinkStore.getState().links).toEqual([LINK]);
  });

  it('removeLink delegates to storage then re-derives', async () => {
    mockLoad.mockResolvedValue([]);
    await useProviderGearLinkStore.getState().removeLink('strava', 'bike-1', 'bike');
    expect(mockRemove).toHaveBeenCalledWith('strava', 'bike-1', 'bike');
    expect(useProviderGearLinkStore.getState().links).toEqual([]);
  });

  it('markLinkStale delegates to storage then re-derives', async () => {
    mockLoad.mockResolvedValue([{ ...LINK, stale: true }]);
    await useProviderGearLinkStore.getState().markLinkStale('strava', 'bike-1', 'bike');
    expect(mockMarkStale).toHaveBeenCalledWith('strava', 'bike-1', 'bike');
    expect(useProviderGearLinkStore.getState().links).toEqual([{ ...LINK, stale: true }]);
  });

  it('clearLinksForProvider removes that provider via storage then re-derives', async () => {
    mockLoad.mockResolvedValue([]);
    await useProviderGearLinkStore.getState().clearLinksForProvider('strava');
    expect(mockRemoveForProvider).toHaveBeenCalledWith('strava');
    expect(useProviderGearLinkStore.getState().links).toEqual([]);
  });
});
