import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDeviceConnection } from '../hooks/useDeviceConnection';
import { useTrainingSession } from '../hooks/useTrainingSession';
import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { bleDeviceStatus, deviceStatusLabel } from '../../../services/status/deviceStatus';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { buildTrainingSummaryRoute, POST_FINISH_TRAINING_SUMMARY_SOURCE } from '../navigation/trainingSummaryRoute';
import { resolveHrSourceSummary } from '../../../services/hr/hrStatus';
import { resolveHrReading, resolveEffectiveHrSource } from '../../../services/hr/hrSource';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../../store/hrSourceStore';
import { TrainingPhase } from '../../../types/training';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { StatusPill } from '../../../ui/components/StatusPill';
import { HeartRateSourceTile } from '../components/HeartRateSourceTile';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import { logWc } from '../../../services/watch/wcLog';

const HOME_ROUTE = '/';
const BIKE_SETUP_ROUTE = '/gear-setup?target=bike';

function getPhaseSummary(phase: TrainingPhase): string {
  if (phase === TrainingPhase.Idle) {
    return 'Ready to ride';
  }

  if (phase === TrainingPhase.Active) {
    return 'Ride in progress';
  }

  return 'Ride paused';
}

function getDisconnectedCalloutBody(phase: TrainingPhase): string {
  if (phase === TrainingPhase.Paused) {
    return 'Reconnect your saved bike or choose one in setup before you resume this interrupted workout.';
  }

  return 'Connect your saved bike or choose one in setup before you start a workout from this screen.';
}

export function TrainingDashboardScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const {
    bikeConnected,
    hrConnected,
    latestBikeMetrics,
    latestBluetoothHr,
    latestAppleWatchHr,
    lastAppleWatchSampleAtMs,
    watchAvailability,
  } = useDeviceConnection();
  const { savedHrSource } = useSavedGear();
  const { bikeReconnectState } = useAutoReconnect();
  const [isFinishing, setIsFinishing] = useState(false);

  const activeHrSource = useDeviceConnectionStore((s) => s.activeHrSource);
  const primaryHrSourceFromStore = useHrSourceStore((s) => s.primary);
  const lastBluetoothHrSampleAtMs = useDeviceConnectionStore((s) => s.lastBluetoothHrSampleAtMs);

  // watchSupported mirrors MetronomeEngine: watch is supported when it is not unavailable.
  const savedHrName = savedHrSource?.name ?? null;
  const watchSupported = (watchAvailability ?? 'unavailable') !== 'unavailable';

  // Single shared resolver: session-locked source → user-configured primary → hardware default.
  const effectiveHrSource = resolveEffectiveHrSource({
    activeHrSource,
    primaryHrSource: primaryHrSourceFromStore,
    watchSupported,
    savedHrStrapName: savedHrName,
  });

  const reading = resolveHrReading({
    activeSource: effectiveHrSource,
    latestAppleWatchHr: latestAppleWatchHr ?? null,
    lastAppleWatchSampleAtMs: lastAppleWatchSampleAtMs ?? null,
    latestBluetoothHr: latestBluetoothHr ?? null,
    lastBluetoothHrSampleAtMs: lastBluetoothHrSampleAtMs ?? null,
    bikeHeartRate: latestBikeMetrics?.heartRate ?? null,
    nowMs: Date.now(),
  });

  // effectiveHrSource is always non-null; pass it directly as the idle primary.
  const hrSummary = resolveHrSourceSummary({
    activeHrSource,
    reading,
    primaryHrSource: effectiveHrSource,
    watchAvailability: watchAvailability ?? 'unavailable',
    savedHrName,
    hrConnected,
    phase: session.phase,
    elapsedSeconds: session.elapsedSeconds,
    bikeConnected,
  });

  // Diagnostic: log every HR-tile status transition so the in-workout state machine
  // (connecting → ready → paused → noSignal) is verifiable from the [WC-JS] stream
  // on-device, not by eye. Fires only on a status/name change.
  const hrTileName = hrSummary.name;
  const hrTileStatus = hrSummary.status;
  useEffect(() => {
    logWc(`[hrTile] ${hrTileName} -> ${hrTileStatus}`);
  }, [hrTileName, hrTileStatus]);

  const bikeConnectionStatus = bleDeviceStatus({
    hasSavedDevice: true,
    connected: bikeConnected,
    reconnect: bikeReconnectState,
  });

  const showDisconnectedState =
    !bikeConnected && (session.phase === TrainingPhase.Idle || session.phase === TrainingPhase.Paused);

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    try {
      const sessionId = await session.finishAndDisconnect();
      if (sessionId) {
        router.replace(buildTrainingSummaryRoute(sessionId, POST_FINISH_TRAINING_SUMMARY_SOURCE, HOME_ROUTE));
      } else {
        router.replace(HOME_ROUTE);
      }
    } catch (err: unknown) {
      console.error('[TrainingDashboardScreen] Finish failed:', err);
      setIsFinishing(false);
    }
  };

  return (
    <AppScreen title="Training">
      <View style={styles.screenContent}>
        <View style={styles.heroCard}>
          <Text style={styles.phaseText}>{getPhaseSummary(session.phase)}</Text>
          <Text style={styles.heroValue}>{formatDuration(session.elapsedSeconds)}</Text>
          <Text style={styles.heroCaption}>Elapsed</Text>
        </View>

        <View style={styles.primaryMetricGrid}>
          <MetricTile
            label="Speed"
            value={`${session.currentMetrics.speed.toFixed(1)} km/h`}
            style={styles.primaryMetricTile}
          />
          <MetricTile
            label="Distance"
            value={formatDistanceKm(session.totalDistance)}
            style={styles.primaryMetricTile}
          />
          <MetricTile label="Power" value={`${session.currentMetrics.power} W`} style={styles.primaryMetricTile} />
          <MetricTile
            label="Heart Rate"
            value={formatMetricValue(session.currentMetrics.heartRate ?? null, ' bpm')}
            style={styles.primaryMetricTile}
          />
          <MetricTile
            label="Calories"
            value={`${session.totalCalories.toFixed(1)} kcal`}
            style={styles.primaryMetricTile}
          />
        </View>

        <View style={styles.connectionRow}>
          <View style={styles.connectionPill}>
            <Text style={styles.connectionLabel}>Bike</Text>
            <StatusPill
              status={bikeConnectionStatus}
              accessibilityLabel={`Bike: ${deviceStatusLabel(bikeConnectionStatus)}`}
            />
          </View>
        </View>

        <HeartRateSourceTile name={hrSummary.name} status={hrSummary.status} />

        <View style={styles.controlsCard}>
          <View style={styles.actionRow}>
            {session.phase === TrainingPhase.Idle ? (
              <ActionButton label="Start Ride" onPress={session.start} disabled={!bikeConnected} fullWidth />
            ) : null}
            {session.phase === TrainingPhase.Active ? (
              <ActionButton label="Pause" onPress={session.pause} variant="secondary" />
            ) : null}
            {session.phase === TrainingPhase.Paused ? (
              <ActionButton label="Resume" onPress={session.resume} disabled={!bikeConnected} />
            ) : null}
            {(session.phase === TrainingPhase.Active || session.phase === TrainingPhase.Paused) && (
              <ActionButton
                label={isFinishing ? 'Finishing...' : 'Finish'}
                onPress={handleFinish}
                variant="danger"
                disabled={isFinishing}
              />
            )}
          </View>

          {showDisconnectedState ? (
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>Bike connection required</Text>
              <Text style={styles.calloutBody}>{getDisconnectedCalloutBody(session.phase)}</Text>
              <View style={styles.actionRow}>
                <ActionButton label="Set Up Bike" onPress={() => router.push(BIKE_SETUP_ROUTE)} variant="secondary" />
                <ActionButton label="Back Home" onPress={() => router.replace(HOME_ROUTE)} variant="ghost" />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 16,
  },
  heroCard: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  phaseText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroValue: {
    color: palette.text,
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  heroCaption: {
    color: palette.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryMetricTile: {
    minWidth: 150,
    flexBasis: 150,
  },
  connectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  connectionPill: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  connectionLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  controlsCard: {
    gap: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 20,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  callout: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    padding: 14,
  },
  calloutTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  calloutBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
