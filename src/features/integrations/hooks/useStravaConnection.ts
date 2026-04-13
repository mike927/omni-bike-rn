import { useState } from 'react';

import { authorizeWithStrava, disconnectStrava } from '../../../services/strava/stravaAuthService';
import { useStravaConnectionStore } from '../../../store/stravaConnectionStore';
import { useProviderGearLinkStore } from '../../../store/providerGearLinkStore';
import type { UseStravaConnectionResult } from './useStravaConnectionTypes';

const STRAVA_PROVIDER_ID = 'strava';

export type { UseStravaConnectionResult } from './useStravaConnectionTypes';

export function useStravaConnection(): UseStravaConnectionResult {
  const connected = useStravaConnectionStore((s) => s.connected);
  const athlete = useStravaConnectionStore((s) => s.athlete);
  const setConnected = useStravaConnectionStore((s) => s.setConnected);
  const setDisconnected = useStravaConnectionStore((s) => s.setDisconnected);
  const clearLinksForProvider = useProviderGearLinkStore((s) => s.clearLinksForProvider);

  const [isLoading, setIsLoading] = useState(false);

  const athleteName = athlete ? `${athlete.firstName} ${athlete.lastName}`.trim() : null;

  const connect = async () => {
    setIsLoading(true);
    try {
      const tokens = await authorizeWithStrava();
      setConnected(tokens.athlete);
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Strava.';
      return { success: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    setIsLoading(true);
    try {
      await disconnectStrava();
      setDisconnected();
      // Clear saved gear links so a future reconnect with a different athlete
      // does not reuse stale providerGearIds from the previous account.
      await clearLinksForProvider(STRAVA_PROVIDER_ID);
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect from Strava.';
      return { success: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return { isConnected: connected, athleteName, isLoading, connect, disconnect };
}
