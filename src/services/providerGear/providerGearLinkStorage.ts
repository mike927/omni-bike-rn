import Storage from 'expo-sqlite/kv-store';

import type { GearType } from '../../types/gear';
import type { LinkedProviderGear, ProviderId } from '../../types/providerGear';

const STORAGE_KEY = 'omni:providerGearLinks';

function createEmptyLinks(): LinkedProviderGear[] {
  return [];
}

export async function loadProviderGearLinks(): Promise<LinkedProviderGear[]> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyLinks();
    }

    return JSON.parse(raw) as LinkedProviderGear[];
  } catch (err: unknown) {
    console.error('[providerGearLinkStorage] Failed to load provider gear links:', err);
    return createEmptyLinks();
  }
}

async function persistProviderGearLinks(links: LinkedProviderGear[]): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function isSameLink(
  link: LinkedProviderGear,
  providerId: ProviderId,
  localGearId: string,
  localGearType: GearType,
): boolean {
  return link.providerId === providerId && link.localGearId === localGearId && link.localGearType === localGearType;
}

export async function saveProviderGearLink(link: LinkedProviderGear): Promise<void> {
  const current = await loadProviderGearLinks();
  const next = current.filter((item) => !isSameLink(item, link.providerId, link.localGearId, link.localGearType));
  next.push(link);
  await persistProviderGearLinks(next);
}

export async function removeProviderGearLink(
  providerId: ProviderId,
  localGearId: string,
  localGearType: GearType,
): Promise<void> {
  const current = await loadProviderGearLinks();
  const next = current.filter((item) => !isSameLink(item, providerId, localGearId, localGearType));
  await persistProviderGearLinks(next);
}

export async function markProviderGearLinkStale(
  providerId: ProviderId,
  localGearId: string,
  localGearType: GearType,
): Promise<void> {
  const current = await loadProviderGearLinks();
  const next = current.map((item) =>
    isSameLink(item, providerId, localGearId, localGearType) ? { ...item, stale: true } : item,
  );
  await persistProviderGearLinks(next);
}

export async function getProviderGearLink(
  providerId: ProviderId,
  localGearId: string,
  localGearType: GearType,
): Promise<LinkedProviderGear | null> {
  const current = await loadProviderGearLinks();
  const link = current.find((item) => isSameLink(item, providerId, localGearId, localGearType));
  // Stale links are excluded so the upload orchestrator falls back to the "no linked gear" path
  // rather than retrying an invalid providerGearId on every future upload.
  return link && !link.stale ? link : null;
}

export async function clearProviderGearLinks(): Promise<void> {
  await Storage.removeItem(STORAGE_KEY);
}
