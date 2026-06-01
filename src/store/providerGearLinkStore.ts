import { create } from 'zustand';

import {
  loadProviderGearLinks,
  markProviderGearLinkStale,
  removeProviderGearLink,
  removeProviderGearLinksForProvider,
  saveProviderGearLink,
} from '../services/providerGear/providerGearLinkStorage';
import type { GearType } from '../types/gear';
import type { LinkedProviderGear } from '../types/providerGear';

export interface ProviderGearLinkStore {
  links: LinkedProviderGear[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsertLink: (link: LinkedProviderGear) => Promise<void>;
  removeLink: (providerId: string, localGearId: string, localGearType: GearType) => Promise<void>;
  markLinkStale: (providerId: string, localGearId: string, localGearType: GearType) => Promise<void>;
  /** Clears all stored gear links for a provider. Call on provider disconnect to prevent stale links being reused after account switch. */
  clearLinksForProvider: (providerId: string) => Promise<void>;
}

// Storage owns all list + identity logic. This store is a thin reactive cache:
// every mutation delegates to storage, then re-derives `links` from disk so the
// in-memory copy can never diverge from the source of truth.
export const useProviderGearLinkStore = create<ProviderGearLinkStore>((set, get) => ({
  links: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    set({ links: await loadProviderGearLinks(), hydrated: true });
  },

  upsertLink: async (link) => {
    await saveProviderGearLink(link);
    set({ links: await loadProviderGearLinks() });
  },

  removeLink: async (providerId, localGearId, localGearType) => {
    await removeProviderGearLink(providerId, localGearId, localGearType);
    set({ links: await loadProviderGearLinks() });
  },

  markLinkStale: async (providerId, localGearId, localGearType) => {
    await markProviderGearLinkStale(providerId, localGearId, localGearType);
    set({ links: await loadProviderGearLinks() });
  },

  clearLinksForProvider: async (providerId) => {
    await removeProviderGearLinksForProvider(providerId);
    set({ links: await loadProviderGearLinks() });
  },
}));
