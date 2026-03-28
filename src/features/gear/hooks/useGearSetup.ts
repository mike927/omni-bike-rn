import { useState, useCallback, useRef, useEffect } from 'react';
import type { Device } from 'react-native-ble-plx';

import { useBleScanner } from '../../devices/hooks/useBleScanner';
import { useBlePermission, type BlePermissionStatus } from '../../devices/hooks/useBlePermission';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';
import { validateBikeDevice, validateHrDevice } from '../../../services/ble/bleDeviceValidator';
import { BIKE_SCAN_SERVICE_UUIDS, HR_SCAN_SERVICE_UUIDS } from '../../../services/ble/bleUuids';
import type { GearType, ValidationFailureReason } from '../../../types/gear';

const SIGNAL_TIMEOUT_MS = 8000;

export type GearSetupStep = 'scanning' | 'validating' | 'connecting' | 'awaiting_signal' | 'ready' | 'error';

interface UseGearSetupReturn {
  step: GearSetupStep;
  devices: Device[];
  isScanning: boolean;
  scanError: string | null;
  selectedDevice: Device | null;
  validationError: ValidationFailureReason | null;
  signalConfirmed: boolean;
  startScan: () => Promise<BlePermissionStatus>;
  stopScan: () => void;
  selectDevice: (device: Device) => Promise<void>;
  save: () => Promise<void>;
  reset: () => void;
}

export function useGearSetup(target: GearType): UseGearSetupReturn {
  const { requestBlePermission } = useBlePermission();
  const {
    devices,
    isScanning,
    error: scanError,
    scanForDevices,
    stopScanning,
  } = useBleScanner(target === 'bike' ? BIKE_SCAN_SERVICE_UUIDS : HR_SCAN_SERVICE_UUIDS);
  const { connectBike, connectHr, disconnectBike, disconnectHr } = useDeviceConnection();
  const persistBike = useSavedGearStore((s) => s.persistBike);
  const persistHr = useSavedGearStore((s) => s.persistHr);

  const [step, setStep] = useState<GearSetupStep>('scanning');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [validationError, setValidationError] = useState<ValidationFailureReason | null>(null);
  const [signalConfirmed, setSignalConfirmed] = useState(false);
  const signalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalConfirmedRef = useRef(false);
  const connectedDuringSetupRef = useRef(false);
  const savedRef = useRef(false);

  const fallbackValidationError: ValidationFailureReason =
    target === 'bike' ? 'missing_ftms_service' : 'missing_hr_service';

  const clearSignalTimeout = useCallback(() => {
    if (signalTimeoutRef.current !== null) {
      clearTimeout(signalTimeoutRef.current);
      signalTimeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearSignalTimeout();
    setStep('scanning');
    setSelectedDevice(null);
    setValidationError(null);
    setSignalConfirmed(false);
    signalConfirmedRef.current = false;
    connectedDuringSetupRef.current = false;
    savedRef.current = false;
  }, [clearSignalTimeout]);

  const startScan = useCallback(async () => {
    const permission = await requestBlePermission();
    if (permission === 'denied') return permission;
    await scanForDevices();
    return permission;
  }, [requestBlePermission, scanForDevices]);

  const stopScan = useCallback(() => {
    stopScanning();
  }, [stopScanning]);

  const disconnectSelectedTarget = useCallback(async () => {
    if (target === 'bike') {
      await disconnectBike();
      return;
    }

    await disconnectHr();
  }, [target, disconnectBike, disconnectHr]);

  const selectDevice = useCallback(
    async (device: Device) => {
      clearSignalTimeout();
      stopScanning();
      setSelectedDevice(device);
      setValidationError(null);
      setSignalConfirmed(false);
      signalConfirmedRef.current = false;
      connectedDuringSetupRef.current = false;
      savedRef.current = false;
      setStep('validating');

      const result = target === 'bike' ? await validateBikeDevice(device.id) : await validateHrDevice(device.id);

      if (!result.valid) {
        setValidationError(result.reason ?? fallbackValidationError);
        setStep('error');
        return;
      }

      setStep('connecting');

      try {
        if (target === 'bike') {
          await connectBike(device.id, { reuseExistingConnection: true });
        } else {
          await connectHr(device.id, { reuseExistingConnection: true });
        }
        connectedDuringSetupRef.current = true;
      } catch {
        await disconnectSelectedTarget().catch(() => undefined);
        setValidationError('connection_failed');
        setStep('error');
        return;
      }

      setStep('awaiting_signal');

      signalTimeoutRef.current = setTimeout(() => {
        if (!signalConfirmedRef.current) {
          clearSignalTimeout();
          connectedDuringSetupRef.current = false;
          setValidationError('no_live_signal');
          setStep('error');
          void disconnectSelectedTarget();
        }
      }, SIGNAL_TIMEOUT_MS);
    },
    [
      target,
      stopScanning,
      connectBike,
      connectHr,
      clearSignalTimeout,
      disconnectSelectedTarget,
      fallbackValidationError,
    ],
  );

  // Watch for first live signal after connection
  useEffect(() => {
    if (step !== 'awaiting_signal') return;

    const latestBikeMetrics = useDeviceConnectionStore.getState().latestBikeMetrics;
    const latestHr = useDeviceConnectionStore.getState().latestHr;

    const hasSignal = target === 'bike' ? latestBikeMetrics !== null : latestHr !== null;
    if (hasSignal) {
      clearSignalTimeout();
      signalConfirmedRef.current = true;
      setSignalConfirmed(true);
      setStep('ready');
      return;
    }

    return useDeviceConnectionStore.subscribe((state) => {
      if (signalConfirmedRef.current) return;
      const signal = target === 'bike' ? state.latestBikeMetrics : state.latestHr;
      if (signal !== null) {
        clearSignalTimeout();
        signalConfirmedRef.current = true;
        setSignalConfirmed(true);
        setStep('ready');
      }
    });
  }, [step, target, clearSignalTimeout]);

  useEffect(() => {
    return () => {
      clearSignalTimeout();

      if (connectedDuringSetupRef.current && !savedRef.current) {
        void disconnectSelectedTarget();
      }
    };
  }, [clearSignalTimeout, disconnectSelectedTarget]);

  const save = useCallback(async () => {
    if (!selectedDevice || !signalConfirmed) return;

    const deviceName = selectedDevice.name ?? selectedDevice.id;
    const device = { id: selectedDevice.id, name: deviceName, type: target };

    if (target === 'bike') {
      await persistBike(device);
    } else {
      await persistHr(device);
    }

    savedRef.current = true;
  }, [selectedDevice, signalConfirmed, target, persistBike, persistHr]);

  return {
    step,
    devices,
    isScanning,
    scanError,
    selectedDevice,
    validationError,
    signalConfirmed,
    startScan,
    stopScan,
    selectDevice,
    save,
    reset,
  };
}
