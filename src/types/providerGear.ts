import type { GearType } from './gear';

export type ProviderId = string;

export interface ProviderGearSummary {
  providerId: ProviderId;
  gearType: GearType;
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface LinkedProviderGear {
  providerId: ProviderId;
  localGearId: string;
  localGearType: GearType;
  providerGearId: string;
  providerGearName: string;
  providerGearType: GearType;
  stale: boolean;
  lastSyncedAtMs: number;
}

export type ProviderGearLinkStatus = 'not_linked' | 'linked' | 'stale' | 'no_provider_gear';
