import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { getExportProvider } from '../../../services/export/exportProviderRegistry';
import { listPotentialProviderGearMatches } from '../../../services/export/providerGearMatcher';
import { STRAVA_GEAR_SETTINGS_URL } from '../../../services/strava/stravaConstants';
import { useProviderGearLinkStore } from '../../../store/providerGearLinkStore';
import type { SavedDevice } from '../../../types/gear';
import type { LinkedProviderGear, ProviderGearLinkStatus, ProviderGearSummary } from '../../../types/providerGear';

export interface UseProviderBikeLinkingResult {
  currentLink: LinkedProviderGear | null;
  availableGear: ProviderGearSummary[];
  selectedGearId: string | null;
  potentialMatches: ProviderGearSummary[];
  status: ProviderGearLinkStatus;
  isLoading: boolean;
  isSaving: boolean;
  needsReconnect: boolean;
  errorMessage: string | null;
  selectGear: (providerGearId: string) => void;
  confirmSelection: () => Promise<boolean>;
  clearLink: () => Promise<boolean>;
  refresh: () => Promise<void>;
  openProviderGearManagement: () => Promise<void>;
}

function getManageGearUrl(providerId: string): string | null {
  switch (providerId) {
    case 'strava':
      return STRAVA_GEAR_SETTINGS_URL;
    default:
      return null;
  }
}

export function useProviderBikeLinking(
  providerId: string,
  localBike: SavedDevice | null,
): UseProviderBikeLinkingResult {
  const links = useProviderGearLinkStore((s) => s.links);
  const hydrated = useProviderGearLinkStore((s) => s.hydrated);
  const upsertLink = useProviderGearLinkStore((s) => s.upsertLink);
  const removeLink = useProviderGearLinkStore((s) => s.removeLink);
  const markLinkStale = useProviderGearLinkStore((s) => s.markLinkStale);

  const [availableGear, setAvailableGear] = useState<ProviderGearSummary[]>([]);
  const [selectedGearId, setSelectedGearId] = useState<string | null>(null);
  const [potentialMatches, setPotentialMatches] = useState<ProviderGearSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentLink =
    localBike === null
      ? null
      : (links.find(
          (item) =>
            item.providerId === providerId && item.localGearId === localBike.id && item.localGearType === 'bike',
        ) ?? null);

  const status: ProviderGearLinkStatus = currentLink?.stale
    ? 'stale'
    : currentLink
      ? 'linked'
      : !isLoading && availableGear.length === 0 && localBike
        ? 'no_provider_gear'
        : 'not_linked';

  const refresh = useCallback(async () => {
    if (!localBike || !hydrated) {
      setAvailableGear([]);
      setSelectedGearId(null);
      setPotentialMatches([]);
      setNeedsReconnect(false);
      setErrorMessage(null);
      return;
    }

    const provider = getExportProvider(providerId);

    if (!provider?.listAvailableGear) {
      setErrorMessage(`Provider "${providerId}" does not support gear linking.`);
      return;
    }

    setIsLoading(true);
    setNeedsReconnect(false);
    setErrorMessage(null);

    try {
      const gear = await provider.listAvailableGear('bike');
      const nextPotentialMatches = listPotentialProviderGearMatches(localBike.name, gear);
      const linkedGearStillExists = currentLink !== null && gear.some((item) => item.id === currentLink.providerGearId);

      if (currentLink && !linkedGearStillExists) {
        try {
          await markLinkStale(providerId, localBike.id, 'bike');
        } catch (markError: unknown) {
          console.error('[useProviderBikeLinking] Failed to mark provider bike link stale:', markError);
        }
      }

      setAvailableGear(gear);
      setPotentialMatches(nextPotentialMatches);

      if (linkedGearStillExists) {
        setSelectedGearId(currentLink?.providerGearId ?? null);
      } else {
        setSelectedGearId(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load provider gear.';
      setAvailableGear([]);
      setPotentialMatches([]);
      setSelectedGearId(null);
      setErrorMessage(message);
      setNeedsReconnect(message.includes('Reconnect'));
    } finally {
      setIsLoading(false);
    }
  }, [currentLink, hydrated, localBike, markLinkStale, providerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const confirmSelection = async () => {
    if (!localBike || !selectedGearId) {
      return false;
    }

    const selectedGear = availableGear.find((item) => item.id === selectedGearId);

    if (!selectedGear) {
      return false;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await upsertLink({
        providerId,
        localGearId: localBike.id,
        localGearType: 'bike',
        providerGearId: selectedGear.id,
        providerGearName: selectedGear.name,
        providerGearType: 'bike',
        stale: false,
        lastSyncedAtMs: Date.now(),
      });
      return true;
    } catch (err: unknown) {
      console.error('[useProviderBikeLinking] Failed to save provider bike link:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not save provider bike link.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const clearLink = async () => {
    if (!localBike) {
      return false;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await removeLink(providerId, localBike.id, 'bike');
      setSelectedGearId(null);
      return true;
    } catch (err: unknown) {
      console.error('[useProviderBikeLinking] Failed to clear provider bike link:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not clear provider bike link.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const openProviderGearManagement = async () => {
    const url = getManageGearUrl(providerId);
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (err: unknown) {
      console.error('[useProviderBikeLinking] Failed to open provider gear settings:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not open provider gear settings.');
    }
  };

  return {
    currentLink,
    availableGear,
    selectedGearId,
    potentialMatches,
    status,
    isLoading,
    isSaving,
    needsReconnect,
    errorMessage,
    selectGear: setSelectedGearId,
    confirmSelection,
    clearLink,
    refresh,
    openProviderGearManagement,
  };
}
