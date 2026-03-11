import { useState, useCallback } from 'react';
import type { Device } from 'react-native-ble-plx';
import { ZiproRaveAdapter } from '../../../services/ble/ZiproRaveAdapter';

export function useBikeConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adapter, setAdapter] = useState<ZiproRaveAdapter | null>(null);

  const connectToBike = useCallback(async (device: Device) => {
    try {
      setIsConnecting(true);
      setError(null);

      console.log(`[useBikeConnection] Attempting to connect to ${device.name || device.id}`);

      const newAdapter = new ZiproRaveAdapter(device.id);
      await newAdapter.connect();

      setAdapter(newAdapter);
      setIsConnecting(false);
      console.log(`[useBikeConnection] Successfully connected to ${device.name || device.id}`);
    } catch (err: unknown) {
      console.error('[useBikeConnection] Error connecting:', err);
      setError(err instanceof Error ? err.message : String(err));
      setIsConnecting(false);
    }
  }, []);

  const disconnectFromBike = useCallback(async () => {
    if (adapter) {
      try {
        await adapter.disconnect();
        setAdapter(null);
      } catch (err) {
        console.error('[useBikeConnection] Error disconnecting:', err);
      }
    }
  }, [adapter]);

  return {
    connectToBike,
    disconnectFromBike,
    isConnecting,
    error,
    isConnected: adapter !== null,
  };
}
