import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isExpectedBleConnectTimeoutError } from '../../../services/ble/isExpectedBleConnectTimeoutError';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { isExpectedBleDisconnectError } from '../../../services/ble/isExpectedBleDisconnectError';
import { isConnectInProgressError } from '../../../services/ble/ConnectInProgressError';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSavedGearStore } from '../../../store/savedGearStore';

// Auto-reconnect fires at most MAX_AUTO_RECONNECT_ATTEMPTS probes after a drop:
// probe 1 immediately (0 ms), probe 2 after 3 s, probe 3 after 5 s. Once the last
// probe fails the device is left `disconnected` (shown as "Unavailable") until the
// user taps Connect, which resets the cycle.
const AUTO_RECONNECT_RETRY_DELAYS_MS = [0, 3000, 5000] as const;
const MAX_AUTO_RECONNECT_ATTEMPTS = AUTO_RECONNECT_RETRY_DELAYS_MS.length;

function toReconnectFailureState(err: unknown): 'failed' | 'disconnected' {
  return isExpectedBleDisconnectError(err) || isExpectedBleConnectTimeoutError(err) || isConnectInProgressError(err)
    ? 'disconnected'
    : 'failed';
}

// `attemptCount` = probes already made; returns the wait before the next probe.
function nextAutoReconnectDelayMs(attemptCount: number): number {
  return AUTO_RECONNECT_RETRY_DELAYS_MS[attemptCount] ?? 0;
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
  const bikeConnectionInProgress = useDeviceConnectionStore((s) => s.bikeConnectionInProgress);
  const hrConnectionInProgress = useDeviceConnectionStore((s) => s.hrConnectionInProgress);

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
        bikeAttemptingRef.current = false;
        const nextState = toReconnectFailureState(err);

        if (nextState === 'failed') {
          bikeRetryAttemptCountRef.current = 0;
          clearBikeRetryTimeout();
          setBikeReconnectState('failed');
          console.error('[useAutoReconnect] Bike connect failed:', err);
          return;
        }

        // Transient drop: count this probe and, while the budget remains, stay in
        // the `connecting` display state and schedule the next probe so the chip
        // reads one continuous "Connecting…". Only once the budget is spent do we
        // fall back to `disconnected` (rendered as "Unavailable").
        bikeRetryAttemptCountRef.current += 1;
        if (bikeRetryAttemptCountRef.current >= MAX_AUTO_RECONNECT_ATTEMPTS) {
          clearBikeRetryTimeout();
          setBikeReconnectState('disconnected');
          return;
        }
        setBikeReconnectState('connecting');
        setBikeRetrySignal((value) => value + 1);
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
        hrAttemptingRef.current = false;
        const nextState = toReconnectFailureState(err);

        if (nextState === 'failed') {
          hrRetryAttemptCountRef.current = 0;
          clearHrRetryTimeout();
          setHrReconnectState('failed');
          console.error('[useAutoReconnect] HR connect failed:', err);
          return;
        }

        // Transient drop: count this probe and, while the budget remains, stay in
        // the `connecting` display state and schedule the next probe so the chip
        // reads one continuous "Connecting…". Only once the budget is spent do we
        // fall back to `disconnected` (rendered as "Unavailable").
        hrRetryAttemptCountRef.current += 1;
        if (hrRetryAttemptCountRef.current >= MAX_AUTO_RECONNECT_ATTEMPTS) {
          clearHrRetryTimeout();
          setHrReconnectState('disconnected');
          return;
        }
        setHrReconnectState('connecting');
        setHrRetrySignal((value) => value + 1);
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
    if (bikeAdapter === null) return;

    bikeAttemptingRef.current = false;
    bikeRetryAttemptCountRef.current = 0;
    clearBikeRetryTimeout();
    if (bikeReconnectState !== 'connected') {
      setBikeReconnectState('connected');
    }
  }, [bikeReconnectState, bikeAdapter, clearBikeRetryTimeout, setBikeReconnectState]);

  useEffect(() => {
    if (hrAdapter === null) return;

    hrAttemptingRef.current = false;
    hrRetryAttemptCountRef.current = 0;
    clearHrRetryTimeout();
    if (hrReconnectState !== 'connected') {
      setHrReconnectState('connected');
    }
  }, [hrReconnectState, hrAdapter, clearHrRetryTimeout, setHrReconnectState]);

  // ── Adapter disappeared (post-workout disconnect) ──────────────────
  useEffect(() => {
    if (!savedBike) return;
    if (bikeReconnectState !== 'connected') return;
    if (bikeAdapter !== null) return;
    if (bikeAttemptingRef.current || bikeConnectionInProgress) return;

    setBikeReconnectState('disconnected');
  }, [savedBike, bikeReconnectState, bikeAdapter, bikeConnectionInProgress, setBikeReconnectState]);

  useEffect(() => {
    if (!savedHrSource) return;
    if (hrReconnectState !== 'connected') return;
    if (hrAdapter !== null) return;
    if (hrAttemptingRef.current || hrConnectionInProgress) return;

    setHrReconnectState('disconnected');
  }, [savedHrSource, hrReconnectState, hrAdapter, hrConnectionInProgress, setHrReconnectState]);

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

    // A reconnect cycle is live while the state is `connecting` (active probe or
    // waiting between probes) or `disconnected` (a fresh drop). Once the probe
    // budget is spent we stop and leave the device disconnected (Unavailable).
    const bikeNeedsReconnect = bikeReconnectState === 'connecting' || bikeReconnectState === 'disconnected';
    if (
      !bikeNeedsReconnect ||
      bikeAdapter !== null ||
      bikeAttemptingRef.current ||
      bikeConnectionInProgress ||
      bikeRetryAttemptCountRef.current >= MAX_AUTO_RECONNECT_ATTEMPTS
    ) {
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
    bikeConnectionInProgress,
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

    // A reconnect cycle is live while the state is `connecting` (active probe or
    // waiting between probes) or `disconnected` (a fresh drop). Once the probe
    // budget is spent we stop and leave the device disconnected (Unavailable).
    const hrNeedsReconnect = hrReconnectState === 'connecting' || hrReconnectState === 'disconnected';
    if (
      !hrNeedsReconnect ||
      hrAdapter !== null ||
      hrAttemptingRef.current ||
      hrConnectionInProgress ||
      hrRetryAttemptCountRef.current >= MAX_AUTO_RECONNECT_ATTEMPTS
    ) {
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
    hrConnectionInProgress,
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
