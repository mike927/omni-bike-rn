import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isExpectedBleConnectTimeoutError } from '../../../services/ble/isExpectedBleConnectTimeoutError';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { isExpectedBleDisconnectError } from '../../../services/ble/isExpectedBleDisconnectError';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';

const AUTO_RECONNECT_RETRY_DELAYS_MS = [5000, 10000, 20000, 30000] as const;

function toReconnectFailureState(err: unknown): 'failed' | 'disconnected' {
  return isExpectedBleDisconnectError(err) || isExpectedBleConnectTimeoutError(err) ? 'disconnected' : 'failed';
}

function nextAutoReconnectDelayMs(attemptCount: number): number {
  const attemptIndex = Math.max(0, attemptCount - 1);
  return AUTO_RECONNECT_RETRY_DELAYS_MS[Math.min(attemptIndex, AUTO_RECONNECT_RETRY_DELAYS_MS.length - 1)] ?? 30000;
}

export function useAutoReconnect() {
  const { connectBike, connectHr, disconnectBike, disconnectHr } = useDeviceConnection();
  const savedBike = useSavedGearStore((s) => s.savedBike);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  const hydrated = useSavedGearStore((s) => s.hydrated);
  const bikeReconnectState = useSavedGearStore((s) => s.bikeReconnectState);
  const hrReconnectState = useSavedGearStore((s) => s.hrReconnectState);
  const bikeAutoReconnectSuppressed = useSavedGearStore((s) => s.bikeAutoReconnectSuppressed);
  const hrAutoReconnectSuppressed = useSavedGearStore((s) => s.hrAutoReconnectSuppressed);
  const setBikeReconnectState = useSavedGearStore((s) => s.setBikeReconnectState);
  const setHrReconnectState = useSavedGearStore((s) => s.setHrReconnectState);
  const setBikeAutoReconnectSuppressed = useSavedGearStore((s) => s.setBikeAutoReconnectSuppressed);
  const setHrAutoReconnectSuppressed = useSavedGearStore((s) => s.setHrAutoReconnectSuppressed);
  const bikeAdapter = useDeviceConnectionStore((s) => s.bikeAdapter);
  const hrAdapter = useDeviceConnectionStore((s) => s.hrAdapter);

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [bikeRetrySignal, setBikeRetrySignal] = useState(0);
  const [hrRetrySignal, setHrRetrySignal] = useState(0);
  const bikeAttemptingRef = useRef(false);
  const hrAttemptingRef = useRef(false);
  const bikeRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hrRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bikeRetryAttemptCountRef = useRef(0);
  const hrRetryAttemptCountRef = useRef(0);

  const clearBikeRetryTimeout = useCallback(() => {
    if (bikeRetryTimeoutRef.current !== null) {
      clearTimeout(bikeRetryTimeoutRef.current);
      bikeRetryTimeoutRef.current = null;
    }
  }, []);

  const clearHrRetryTimeout = useCallback(() => {
    if (hrRetryTimeoutRef.current !== null) {
      clearTimeout(hrRetryTimeoutRef.current);
      hrRetryTimeoutRef.current = null;
    }
  }, []);

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
        bikeRetryAttemptCountRef.current = 0;
        clearBikeRetryTimeout();
        if (!isCurrentSavedBikeAttempt(deviceId)) {
          await disconnectBike();
          bikeAttemptingRef.current = false;
          return;
        }
        bikeAttemptingRef.current = false;
        setBikeReconnectState('connected');
      } catch (err: unknown) {
        if (!isCurrentSavedBikeAttempt(deviceId)) {
          bikeAttemptingRef.current = false;
          return;
        }
        const nextState = toReconnectFailureState(err);
        bikeRetryAttemptCountRef.current = nextState === 'disconnected' ? bikeRetryAttemptCountRef.current + 1 : 0;
        if (nextState === 'failed') {
          clearBikeRetryTimeout();
          console.error('[useAutoReconnect] Bike connect failed:', err);
        }
        bikeAttemptingRef.current = false;
        if (nextState === 'disconnected') {
          setBikeRetrySignal((value) => value + 1);
        }
        setBikeReconnectState(nextState);
      }
    },
    [clearBikeRetryTimeout, disconnectBike, isCurrentSavedBikeAttempt, runBikeConnect, setBikeReconnectState],
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
        hrRetryAttemptCountRef.current = 0;
        clearHrRetryTimeout();
        if (!isCurrentSavedHrAttempt(deviceId)) {
          await disconnectHr();
          hrAttemptingRef.current = false;
          return;
        }
        hrAttemptingRef.current = false;
        setHrReconnectState('connected');
      } catch (err: unknown) {
        if (!isCurrentSavedHrAttempt(deviceId)) {
          hrAttemptingRef.current = false;
          return;
        }
        const nextState = toReconnectFailureState(err);
        hrRetryAttemptCountRef.current = nextState === 'disconnected' ? hrRetryAttemptCountRef.current + 1 : 0;
        if (nextState === 'failed') {
          clearHrRetryTimeout();
          console.error('[useAutoReconnect] HR connect failed:', err);
        }
        hrAttemptingRef.current = false;
        if (nextState === 'disconnected') {
          setHrRetrySignal((value) => value + 1);
        }
        setHrReconnectState(nextState);
      }
    },
    [clearHrRetryTimeout, disconnectHr, isCurrentSavedHrAttempt, runHrConnect, setHrReconnectState],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);

    return () => {
      subscription.remove();
    };
  }, []);

  // ── Initial auto-connect on mount ──────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (!savedBike) return;
    if (bikeAutoReconnectSuppressed) return;
    if (bikeReconnectState !== 'idle') return;
    if (bikeAdapter !== null) return;
    void startBikeReconnect(savedBike.id);
  }, [hydrated, savedBike, bikeAutoReconnectSuppressed, bikeReconnectState, bikeAdapter, startBikeReconnect]);

  useEffect(() => {
    if (!hydrated) return;
    if (!savedHrSource) return;
    if (hrAutoReconnectSuppressed) return;
    if (hrReconnectState !== 'idle') return;
    if (hrAdapter !== null) return;
    void startHrReconnect(savedHrSource.id);
  }, [hydrated, savedHrSource, hrAutoReconnectSuppressed, hrReconnectState, hrAdapter, startHrReconnect]);

  // ── Adapter appeared externally (e.g. gear setup flow) ─────────────
  useEffect(() => {
    if (bikeReconnectState !== 'connecting') return;
    if (bikeAdapter === null) return;

    bikeAttemptingRef.current = false;
    bikeRetryAttemptCountRef.current = 0;
    clearBikeRetryTimeout();
    setBikeReconnectState('connected');
  }, [bikeReconnectState, bikeAdapter, clearBikeRetryTimeout, setBikeReconnectState]);

  useEffect(() => {
    if (hrReconnectState !== 'connecting') return;
    if (hrAdapter === null) return;

    hrAttemptingRef.current = false;
    hrRetryAttemptCountRef.current = 0;
    clearHrRetryTimeout();
    setHrReconnectState('connected');
  }, [hrReconnectState, hrAdapter, clearHrRetryTimeout, setHrReconnectState]);

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

  useEffect(() => {
    if (appState !== 'active') {
      clearBikeRetryTimeout();
      return;
    }

    if (!hydrated || !savedBike) {
      clearBikeRetryTimeout();
      bikeRetryAttemptCountRef.current = 0;
      return;
    }

    if (bikeAutoReconnectSuppressed) {
      clearBikeRetryTimeout();
      return;
    }

    if (bikeReconnectState !== 'disconnected' || bikeAdapter !== null || bikeAttemptingRef.current) {
      clearBikeRetryTimeout();
      return;
    }

    clearBikeRetryTimeout();
    bikeRetryTimeoutRef.current = setTimeout(() => {
      bikeRetryTimeoutRef.current = null;
      void startBikeReconnect(savedBike.id);
    }, nextAutoReconnectDelayMs(bikeRetryAttemptCountRef.current));

    return clearBikeRetryTimeout;
  }, [
    appState,
    hydrated,
    savedBike,
    bikeReconnectState,
    bikeAdapter,
    bikeAutoReconnectSuppressed,
    bikeRetrySignal,
    clearBikeRetryTimeout,
    startBikeReconnect,
  ]);

  useEffect(() => {
    if (appState !== 'active') {
      clearHrRetryTimeout();
      return;
    }

    if (!hydrated || !savedHrSource) {
      clearHrRetryTimeout();
      hrRetryAttemptCountRef.current = 0;
      return;
    }

    if (hrAutoReconnectSuppressed) {
      clearHrRetryTimeout();
      return;
    }

    if (hrReconnectState !== 'disconnected' || hrAdapter !== null || hrAttemptingRef.current) {
      clearHrRetryTimeout();
      return;
    }

    clearHrRetryTimeout();
    hrRetryTimeoutRef.current = setTimeout(() => {
      hrRetryTimeoutRef.current = null;
      void startHrReconnect(savedHrSource.id);
    }, nextAutoReconnectDelayMs(hrRetryAttemptCountRef.current));

    return clearHrRetryTimeout;
  }, [
    appState,
    hydrated,
    savedHrSource,
    hrReconnectState,
    hrAdapter,
    hrAutoReconnectSuppressed,
    hrRetrySignal,
    clearHrRetryTimeout,
    startHrReconnect,
  ]);

  const retryBike = useCallback(() => {
    if (!hydrated || !savedBike) {
      return;
    }

    if (bikeAdapter !== null) {
      bikeRetryAttemptCountRef.current = 0;
      clearBikeRetryTimeout();
      setBikeAutoReconnectSuppressed(false);
      setBikeReconnectState('connected');
      return;
    }

    bikeRetryAttemptCountRef.current = 0;
    clearBikeRetryTimeout();
    setBikeAutoReconnectSuppressed(false);
    void startBikeReconnect(savedBike.id);
  }, [
    clearBikeRetryTimeout,
    hydrated,
    savedBike,
    bikeAdapter,
    setBikeAutoReconnectSuppressed,
    setBikeReconnectState,
    startBikeReconnect,
  ]);

  const retryHr = useCallback(() => {
    if (!hydrated || !savedHrSource) {
      return;
    }

    if (hrAdapter !== null) {
      hrRetryAttemptCountRef.current = 0;
      clearHrRetryTimeout();
      setHrAutoReconnectSuppressed(false);
      setHrReconnectState('connected');
      return;
    }

    hrRetryAttemptCountRef.current = 0;
    clearHrRetryTimeout();
    setHrAutoReconnectSuppressed(false);
    void startHrReconnect(savedHrSource.id);
  }, [
    clearHrRetryTimeout,
    hydrated,
    savedHrSource,
    hrAdapter,
    setHrAutoReconnectSuppressed,
    setHrReconnectState,
    startHrReconnect,
  ]);

  useEffect(
    () => () => {
      clearBikeRetryTimeout();
      clearHrRetryTimeout();
    },
    [clearBikeRetryTimeout, clearHrRetryTimeout],
  );

  return {
    bikeReconnectState,
    hrReconnectState,
    retryBike,
    retryHr,
  };
}
