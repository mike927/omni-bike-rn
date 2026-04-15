import { useState, useCallback, useEffect } from 'react';
import type { Device } from 'react-native-ble-plx';
import { bleManager } from '../../../services/ble/bleClient';

type ClientScanFilter = (device: Device) => boolean;

export function useBleScanner(serviceUUIDs: string[] | null = null, clientFilter: ClientScanFilter | null = null) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanForDevices = useCallback(async () => {
    try {
      const state = await bleManager.state();
      if (state !== 'PoweredOn') {
        setError(`Bluetooth is not powered on (Current state: ${state})`);
        return;
      }

      setError(null);
      setIsScanning(true);
      setDevices([]);

      bleManager.startDeviceScan(serviceUUIDs, null, (scanError, device) => {
        if (scanError) {
          console.error('Scan error:', scanError);
          setError(scanError.message);
          setIsScanning(false);
          return;
        }

        if (device && device.name) {
          if (clientFilter && !clientFilter(device)) {
            return;
          }
          setDevices((prevDevices) => {
            const deviceExists = prevDevices.find((d) => d.id === device.id);
            if (!deviceExists) {
              return [...prevDevices, device];
            }
            return prevDevices;
          });
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsScanning(false);
    }
  }, [serviceUUIDs, clientFilter]);

  const stopScanning = useCallback(() => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isScanning) {
        bleManager.stopDeviceScan();
      }
    };
  }, [isScanning]);

  return {
    devices,
    isScanning,
    error,
    scanForDevices,
    stopScanning,
  };
}
