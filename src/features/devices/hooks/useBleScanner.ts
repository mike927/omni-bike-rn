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

      void bleManager.startDeviceScan(serviceUUIDs, null, (scanError, device) => {
        if (scanError) {
          console.error('Scan error:', scanError);
          setError(scanError.message);
          setIsScanning(false);
          return;
        }

        if (!device) return;

        // Deliberately NOT gating on `device.name`. Broadcast-capable Garmin /
        // Polar watches are exactly the class of peripherals that can satisfy
        // the HR scan filter (standard HR service or wearable vendor Company
        // ID in manufacturerData) while their local name has not yet been
        // parsed, so dropping nameless advertisements at admission time would
        // reintroduce the exact silent-drop bug this feature branch exists to
        // fix. The UI (`GearSetupScreen.tsx`) renders `device.name ?? 'Unknown
        // Device'` as a fallback. Dedup below is keyed on `device.id`, so a
        // device that first appears nameless and later with a name is still
        // rendered once — the first representation wins.
        //
        // Diagnostic logging pathway: if a future user reports "my broadcast-
        // capable watch is not visible", re-add a __DEV__-gated `[ScanDump]`
        // here that logs `device.name`, `device.id`, `device.rssi`,
        // `device.serviceUUIDs`, `device.manufacturerData`, and the decoded
        // 16-bit Company ID (first two bytes, little-endian), plus a REJECTED
        // marker when `clientFilter` drops one. Full rationale and real-
        // hardware advertisement shapes captured during the
        // feat/garmin-hr-ble-source diagnostic pass live in
        // `docs/vendor/garmin/hr-broadcast/README.md` → "On-device diagnosis
        // notes".
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
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsScanning(false);
    }
  }, [serviceUUIDs, clientFilter]);

  const stopScanning = useCallback(() => {
    void bleManager.stopDeviceScan();
    setIsScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isScanning) {
        void bleManager.stopDeviceScan();
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
