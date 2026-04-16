import type { GearType } from './gear';

export interface ProviderGearSummary {
  providerId: string;
  gearType: GearType;
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface LinkedProviderGear {
  providerId: string;
  localGearId: string;
  localGearType: GearType;
  providerGearId: string;
  providerGearName: string;
  providerGearType: GearType;
  stale: boolean;
  lastSyncedAtMs: number;
}

export type ProviderGearLinkStatus = 'not_linked' | 'linked' | 'stale' | 'no_provider_gear';
