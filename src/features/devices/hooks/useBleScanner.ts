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
          // TEMPORARY DIAGNOSTIC: dump full advertisement for every named device seen
          // during the scan so we can tune isLikelyHrCandidate against real hardware
          // (Garmin Venu gen 1 vs MacBook / Samsung TV / generic BLE noise). Remove
          // after the scan-filter heuristic is confirmed against real data.
          if (__DEV__) {
            const mfg = device.manufacturerData;
            let companyIdHex: string | null = null;
            if (mfg) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Buffer } = require('buffer');
                const bytes = Buffer.from(mfg, 'base64');
                if (bytes.length >= 2) {
                  const lo = bytes[0] ?? 0;
                  const hi = bytes[1] ?? 0;
                  companyIdHex = `0x${((hi << 8) | lo).toString(16).padStart(4, '0')}`;
                }
              } catch {
                companyIdHex = 'decode_error';
              }
            }
            console.warn(
              `[ScanDump] name="${device.name}" id=${device.id} rssi=${device.rssi} ` +
                `serviceUUIDs=${JSON.stringify(device.serviceUUIDs)} ` +
                `manufacturerData=${mfg ?? 'null'} companyId=${companyIdHex ?? 'none'}`,
            );
          }

          if (clientFilter && !clientFilter(device)) {
            if (__DEV__) {
              console.warn(`[ScanDump]   -> REJECTED by clientFilter`);
            }
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
