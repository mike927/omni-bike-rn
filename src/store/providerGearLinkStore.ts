import { create } from 'zustand';

import {
  clearProviderGearLinks,
  loadProviderGearLinks,
  markProviderGearLinkStale,
  removeProviderGearLink,
  saveProviderGearLink,
} from '../services/providerGear/providerGearLinkStorage';
import type { GearType } from '../types/gear';
import type { LinkedProviderGear, ProviderId } from '../types/providerGear';

export interface ProviderGearLinkStore {
  links: LinkedProviderGear[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsertLink: (link: LinkedProviderGear) => Promise<void>;
  removeLink: (providerId: ProviderId, localGearId: string, localGearType: GearType) => Promise<void>;
  markLinkStale: (providerId: ProviderId, localGearId: string, localGearType: GearType) => Promise<void>;
  /** Clears all stored gear links for a provider. Call on provider disconnect to prevent stale links being reused after account switch. */
  clearLinksForProvider: (providerId: ProviderId) => Promise<void>;
}

function isSameLink(
  item: LinkedProviderGear,
  providerId: string,
  localGearId: string,
  localGearType: GearType,
): boolean {
  return item.providerId === providerId && item.localGearId === localGearId && item.localGearType === localGearType;
}

function updateLinks(links: LinkedProviderGear[], nextLink: LinkedProviderGear): LinkedProviderGear[] {
  return [
    ...links.filter(
      (item) =>
        !(
          item.providerId === nextLink.providerId &&
          item.localGearId === nextLink.localGearId &&
          item.localGearType === nextLink.localGearType
        ),
    ),
    nextLink,
  ];
}

export const useProviderGearLinkStore = create<ProviderGearLinkStore>((set, get) => ({
  links: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const links = await loadProviderGearLinks();
    set({ links, hydrated: true });
  },

  upsertLink: async (link) => {
    await saveProviderGearLink(link);
    set((state) => ({ links: updateLinks(state.links, link) }));
  },

  removeLink: async (providerId, localGearId, localGearType) => {
    await removeProviderGearLink(providerId, localGearId, localGearType);
    set((state) => ({
      links: state.links.filter((item) => !isSameLink(item, providerId, localGearId, localGearType)),
    }));
  },

  markLinkStale: async (providerId, localGearId, localGearType) => {
    await markProviderGearLinkStale(providerId, localGearId, localGearType);
    set((state) => ({
      links: state.links.map((item) =>
        isSameLink(item, providerId, localGearId, localGearType) ? { ...item, stale: true } : item,
      ),
    }));
  },

  clearLinksForProvider: async (providerId) => {
    await clearProviderGearLinks();
    set((state) => ({ links: state.links.filter((item) => item.providerId !== providerId) }));
  },
}));
