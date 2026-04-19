import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useDeviceConnection } from '../hooks/useDeviceConnection';
import { useTrainingSession } from '../hooks/useTrainingSession';
import { buildTrainingSummaryRoute, POST_FINISH_TRAINING_SUMMARY_SOURCE } from '../navigation/trainingSummaryRoute';
import { isAppleWatchAvailable } from '../../../services/watch/isAppleWatchAvailable';
import { TrainingPhase } from '../../../types/training';
import type { WatchAvailability } from '../../../types/watch';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

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

function getWatchStatusLabel(watchAvailability: WatchAvailability): string {
  if (watchAvailability === 'unavailable') return 'Unavailable';
  if (watchAvailability === 'idle') return 'Idle';
  return 'In Progress';
}

export function TrainingDashboardScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { bikeConnected, hrConnected, latestBluetoothHr, latestAppleWatchHr, watchAvailability } =
    useDeviceConnection();
  const [isFinishing, setIsFinishing] = useState(false);
  const watchAvailable = isAppleWatchAvailable(Platform.OS);
  // Idle-state fallback: session HR (from MetronomeEngine, which already applies full priority)
  // takes precedence; Watch HR and Bluetooth HR are pre-start previews in priority order.
  const resolvedHeartRate = session.currentMetrics.heartRate ?? latestAppleWatchHr ?? latestBluetoothHr;
  // Watch HR has highest priority in MetronomeEngine; if it's non-null, it is the active source.
  const watchIsActiveSource = latestAppleWatchHr !== null;
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
            label={watchIsActiveSource ? 'Heart Rate ⌚' : 'Heart Rate'}
            value={formatMetricValue(resolvedHeartRate, ' bpm')}
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
            <Text style={styles.connectionValue}>{bikeConnected ? 'Connected' : 'Disconnected'}</Text>
          </View>
          <View style={styles.connectionPill}>
            <Text style={styles.connectionLabel}>Bluetooth HR</Text>
            <Text style={styles.connectionValue}>{hrConnected ? 'Connected' : 'Disconnected'}</Text>
          </View>
          {watchAvailable ? (
            <View style={styles.connectionPill}>
              <Text style={styles.connectionLabel}>Watch HR</Text>
              <Text style={styles.connectionValue}>{getWatchStatusLabel(watchAvailability)}</Text>
            </View>
          ) : null}
        </View>

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
  connectionValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
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
