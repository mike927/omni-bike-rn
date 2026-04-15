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
          // If a future user reports "my broadcast-capable watch is not visible",
          // the easiest way to gather evidence is to temporarily re-enable a
          // `[ScanDump]` diagnostic here: log device.name, device.id, device.rssi,
          // device.serviceUUIDs, device.manufacturerData, and the decoded 16-bit
          // Company ID (first two bytes of manufacturerData, little-endian) for
          // every candidate plus a REJECTED marker when `clientFilter` drops one.
          // Full rationale and real-hardware advertisement shapes captured during
          // the feat/garmin-hr-ble-source diagnostic pass live in
          // `docs/vendor/garmin/hr-broadcast/README.md` → "On-device diagnosis
          // notes". Keep the diagnostic gated on __DEV__ if re-added.
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
