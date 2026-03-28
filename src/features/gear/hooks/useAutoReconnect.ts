import { useEffect, useRef, useCallback } from 'react';

import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { isExpectedBleDisconnectError } from '../../../services/ble/isExpectedBleDisconnectError';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';

function toReconnectFailureState(err: unknown): 'failed' | 'disconnected' {
  return isExpectedBleDisconnectError(err) ? 'disconnected' : 'failed';
}

export function useAutoReconnect() {
  const { connectBike, connectHr, disconnectBike, disconnectHr } = useDeviceConnection();
  const savedBike = useSavedGearStore((s) => s.savedBike);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  const hydrated = useSavedGearStore((s) => s.hydrated);
  const bikeReconnectState = useSavedGearStore((s) => s.bikeReconnectState);
  const hrReconnectState = useSavedGearStore((s) => s.hrReconnectState);
  const setBikeReconnectState = useSavedGearStore((s) => s.setBikeReconnectState);
  const setHrReconnectState = useSavedGearStore((s) => s.setHrReconnectState);
  const bikeAdapter = useDeviceConnectionStore((s) => s.bikeAdapter);
  const hrAdapter = useDeviceConnectionStore((s) => s.hrAdapter);

  const bikeAttemptingRef = useRef(false);
  const hrAttemptingRef = useRef(false);

  const runBikeConnect = useCallback(
    async (deviceId: string) => {
      await connectBike(deviceId);
    },
    [connectBike],
  );

  const runHrConnect = useCallback(
    async (deviceId: string) => {
      await connectHr(deviceId);
    },
    [connectHr],
  );

  const isCurrentSavedBikeAttempt = useCallback((deviceId: string): boolean => {
    return useSavedGearStore.getState().savedBike?.id === deviceId;
  }, []);

  const isCurrentSavedHrAttempt = useCallback((deviceId: string): boolean => {
    return useSavedGearStore.getState().savedHrSource?.id === deviceId;
  }, []);

  const startBikeReconnect = useCallback(
    async (deviceId: string) => {
      if (bikeAttemptingRef.current) {
        return;
      }

      bikeAttemptingRef.current = true;
      setBikeReconnectState('connecting');

      try {
        await runBikeConnect(deviceId);
        if (!isCurrentSavedBikeAttempt(deviceId)) {
          await disconnectBike();
          return;
        }
        setBikeReconnectState('connected');
      } catch (err: unknown) {
        if (!isCurrentSavedBikeAttempt(deviceId)) {
          return;
        }
        const nextState = toReconnectFailureState(err);
        if (nextState === 'failed') {
          console.error('[useAutoReconnect] Bike connect failed:', err);
        }
        setBikeReconnectState(nextState);
      } finally {
        bikeAttemptingRef.current = false;
      }
    },
    [disconnectBike, isCurrentSavedBikeAttempt, runBikeConnect, setBikeReconnectState],
  );

  const startHrReconnect = useCallback(
    async (deviceId: string) => {
      if (hrAttemptingRef.current) {
        return;
      }

      hrAttemptingRef.current = true;
      setHrReconnectState('connecting');

      try {
        await runHrConnect(deviceId);
        if (!isCurrentSavedHrAttempt(deviceId)) {
          await disconnectHr();
          return;
        }
        setHrReconnectState('connected');
      } catch (err: unknown) {
        if (!isCurrentSavedHrAttempt(deviceId)) {
          return;
        }
        const nextState = toReconnectFailureState(err);
        if (nextState === 'failed') {
          console.error('[useAutoReconnect] HR connect failed:', err);
        }
        setHrReconnectState(nextState);
      } finally {
        hrAttemptingRef.current = false;
      }
    },
    [disconnectHr, isCurrentSavedHrAttempt, runHrConnect, setHrReconnectState],
  );

  // ── Initial auto-connect on mount ──────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (!savedBike) return;
    if (bikeReconnectState !== 'idle') return;
    if (bikeAdapter !== null) return;
    void startBikeReconnect(savedBike.id);
  }, [hydrated, savedBike, bikeReconnectState, bikeAdapter, startBikeReconnect]);

  useEffect(() => {
    if (!hydrated) return;
    if (!savedHrSource) return;
    if (hrReconnectState !== 'idle') return;
    if (hrAdapter !== null) return;
    void startHrReconnect(savedHrSource.id);
  }, [hydrated, savedHrSource, hrReconnectState, hrAdapter, startHrReconnect]);

  // ── Adapter appeared externally (e.g. gear setup flow) ─────────────
  useEffect(() => {
    if (bikeReconnectState !== 'connecting') return;
    if (bikeAdapter === null) return;

    bikeAttemptingRef.current = false;
    setBikeReconnectState('connected');
  }, [bikeReconnectState, bikeAdapter, setBikeReconnectState]);

  useEffect(() => {
    if (hrReconnectState !== 'connecting') return;
    if (hrAdapter === null) return;

    hrAttemptingRef.current = false;
    setHrReconnectState('connected');
  }, [hrReconnectState, hrAdapter, setHrReconnectState]);

  // ── Adapter disappeared (post-workout disconnect) ──────────────────
  useEffect(() => {
    if (!savedBike) return;
    if (bikeReconnectState !== 'connected') return;
    if (bikeAdapter !== null) return;
    if (bikeAttemptingRef.current) return;

    setBikeReconnectState('disconnected');
  }, [savedBike, bikeReconnectState, bikeAdapter, setBikeReconnectState]);

  useEffect(() => {
    if (!savedHrSource) return;
    if (hrReconnectState !== 'connected') return;
    if (hrAdapter !== null) return;
    if (hrAttemptingRef.current) return;

    setHrReconnectState('disconnected');
  }, [savedHrSource, hrReconnectState, hrAdapter, setHrReconnectState]);

  const retryBike = useCallback(() => {
    if (!hydrated || !savedBike) {
      return;
    }

    if (bikeAdapter !== null) {
      setBikeReconnectState('connected');
      return;
    }

    void startBikeReconnect(savedBike.id);
  }, [hydrated, savedBike, bikeAdapter, setBikeReconnectState, startBikeReconnect]);

  const retryHr = useCallback(() => {
    if (!hydrated || !savedHrSource) {
      return;
    }

    if (hrAdapter !== null) {
      setHrReconnectState('connected');
      return;
    }

    void startHrReconnect(savedHrSource.id);
  }, [hydrated, savedHrSource, hrAdapter, setHrReconnectState, startHrReconnect]);

  return {
    bikeReconnectState,
    hrReconnectState,
    retryBike,
    retryHr,
  };
}
