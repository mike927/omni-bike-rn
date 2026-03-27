import { useEffect, useRef, useCallback } from 'react';

import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';

export function useAutoReconnect() {
  const { connectBike, connectHr } = useDeviceConnection();
  const savedBike = useSavedGearStore((s) => s.savedBike);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  const hydrated = useSavedGearStore((s) => s.hydrated);
  const bikeReconnectState = useSavedGearStore((s) => s.bikeReconnectState);
  const hrReconnectState = useSavedGearStore((s) => s.hrReconnectState);
  const setBikeReconnectState = useSavedGearStore((s) => s.setBikeReconnectState);
  const setHrReconnectState = useSavedGearStore((s) => s.setHrReconnectState);

  const bikeAttemptingRef = useRef(false);
  const hrAttemptingRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!savedBike) return;
    if (bikeReconnectState !== 'idle') return;
    if (useDeviceConnectionStore.getState().bikeAdapter !== null) return;
    if (bikeAttemptingRef.current) return;

    bikeAttemptingRef.current = true;
    setBikeReconnectState('connecting');

    connectBike(savedBike.id)
      .then(() => {
        setBikeReconnectState('connected');
      })
      .catch((err: unknown) => {
        console.error('[useAutoReconnect] Bike reconnect failed:', err);
        setBikeReconnectState('failed');
      })
      .finally(() => {
        bikeAttemptingRef.current = false;
      });
  }, [hydrated, savedBike, bikeReconnectState, connectBike, setBikeReconnectState]);

  useEffect(() => {
    if (!hydrated) return;
    if (!savedHrSource) return;
    if (hrReconnectState !== 'idle') return;
    if (useDeviceConnectionStore.getState().hrAdapter !== null) return;
    if (hrAttemptingRef.current) return;

    hrAttemptingRef.current = true;
    setHrReconnectState('connecting');

    connectHr(savedHrSource.id)
      .then(() => {
        setHrReconnectState('connected');
      })
      .catch((err: unknown) => {
        console.error('[useAutoReconnect] HR reconnect failed:', err);
        setHrReconnectState('failed');
      })
      .finally(() => {
        hrAttemptingRef.current = false;
      });
  }, [hydrated, savedHrSource, hrReconnectState, connectHr, setHrReconnectState]);

  const retryBike = useCallback(() => {
    setBikeReconnectState('idle');
  }, [setBikeReconnectState]);

  const retryHr = useCallback(() => {
    setHrReconnectState('idle');
  }, [setHrReconnectState]);

  return {
    bikeReconnectState,
    hrReconnectState,
    retryBike,
    retryHr,
  };
}
