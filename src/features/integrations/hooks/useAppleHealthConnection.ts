import { useState } from 'react';

import { initWithWritePermissions } from '../../../services/health/appleHealthAdapter';
import { useAppleHealthConnectionStore } from '../../../store/appleHealthConnectionStore';
import type { UseAppleHealthConnectionResult } from './useAppleHealthConnectionTypes';

export type { UseAppleHealthConnectionResult } from './useAppleHealthConnectionTypes';

export function useAppleHealthConnection(): UseAppleHealthConnectionResult {
  const connected = useAppleHealthConnectionStore((s) => s.connected);
  const setConnected = useAppleHealthConnectionStore((s) => s.setConnected);
  const setDisconnected = useAppleHealthConnectionStore((s) => s.setDisconnected);

  const [isLoading, setIsLoading] = useState(false);

  const connect = async () => {
    setIsLoading(true);
    try {
      // iOS privacy rules don't let us verify that write permission was granted
      // after the sheet closes — a "success" callback only means the user
      // interacted with the sheet. We optimistically flip the local flag and
      // surface any real permission error on the first saveWorkout call.
      await initWithWritePermissions();
      await setConnected();
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Apple Health.';
      return { success: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    setIsLoading(true);
    try {
      await setDisconnected();
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect Apple Health.';
      return { success: false, errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return { isConnected: connected, isLoading, connect, disconnect };
}
