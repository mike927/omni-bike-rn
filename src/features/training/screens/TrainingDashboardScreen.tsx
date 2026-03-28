import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useDeviceConnection } from '../hooks/useDeviceConnection';
import { useTrainingSession } from '../hooks/useTrainingSession';
import { TrainingPhase } from '../../../types/training';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

const HOME_ROUTE = '/';
const BIKE_SETUP_ROUTE = '/gear-setup?target=bike';
const SUMMARY_ROUTE = '/summary';

function getControlDescription(phase: TrainingPhase): string {
  if (phase === TrainingPhase.Idle) {
    return 'Start a ride once your bike is connected. The dashboard will keep updating while the session is active.';
  }

  if (phase === TrainingPhase.Active) {
    return 'Pause if you need a break or finish the ride to move into the summary flow.';
  }

  if (phase === TrainingPhase.Paused) {
    return 'Resume when you are ready to keep riding, or finish the workout from this paused state.';
  }

  return 'The session has ended. Open the summary screen to review the latest totals.';
}

export function TrainingDashboardScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { bikeConnected, hrConnected, latestHr } = useDeviceConnection();
  const resolvedHeartRate = session.currentMetrics.heartRate ?? latestHr;
  const showDisconnectedState = session.phase === TrainingPhase.Idle && !bikeConnected;

  return (
    <AppScreen
      title="Training"
      subtitle="Track your live ride metrics here and control the current workout without leaving the session.">
      <SectionCard
        title="Live Ride"
        description="The core workout metrics stay front and center while secondary device details remain available below.">
        <View style={styles.primaryMetricGrid}>
          <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.primaryMetricTile} />
          <MetricTile
            label="Speed"
            value={`${session.currentMetrics.speed.toFixed(1)} km/h`}
            style={styles.primaryMetricTile}
          />
          <MetricTile
            label="Heart Rate"
            value={formatMetricValue(resolvedHeartRate, ' bpm')}
            style={styles.primaryMetricTile}
          />
          <MetricTile label="Power" value={`${session.currentMetrics.power} W`} style={styles.primaryMetricTile} />
          <MetricTile
            label="Calories"
            value={`${session.totalCalories.toFixed(1)} kcal`}
            style={styles.primaryMetricTile}
          />
        </View>
      </SectionCard>

      <SectionCard title="Session Controls" description={getControlDescription(session.phase)}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{session.phase}</Text>
        </View>
        <View style={styles.actionRow}>
          {session.phase === TrainingPhase.Idle ? (
            <ActionButton label="Start" onPress={session.start} disabled={!bikeConnected} />
          ) : null}
          {session.phase === TrainingPhase.Active ? (
            <ActionButton label="Pause" onPress={session.pause} variant="secondary" />
          ) : null}
          {session.phase === TrainingPhase.Paused ? <ActionButton label="Resume" onPress={session.resume} /> : null}
          {(session.phase === TrainingPhase.Active || session.phase === TrainingPhase.Paused) && (
            <ActionButton label="Finish" onPress={session.finish} variant="danger" />
          )}
          {session.phase === TrainingPhase.Finished ? (
            <ActionButton label="View Summary" onPress={() => router.push(SUMMARY_ROUTE)} />
          ) : null}
        </View>
        {showDisconnectedState ? (
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>Bike connection required</Text>
            <Text style={styles.calloutBody}>
              Connect your saved bike or choose one in setup before you start a workout from this screen.
            </Text>
            <View style={styles.actionRow}>
              <ActionButton label="Set Up Bike" onPress={() => router.push(BIKE_SETUP_ROUTE)} variant="secondary" />
              <ActionButton label="Back Home" onPress={() => router.replace(HOME_ROUTE)} variant="ghost" />
            </View>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Ride Details" description="Secondary details help confirm machine state and sensor health.">
        <View style={styles.secondaryMetricGrid}>
          <MetricTile
            label="Distance"
            value={formatDistanceKm(session.totalDistance)}
            style={styles.secondaryMetricTile}
          />
          <MetricTile
            label="Cadence"
            value={`${session.currentMetrics.cadence} rpm`}
            style={styles.secondaryMetricTile}
          />
          <MetricTile
            label="Resistance"
            value={formatMetricValue(session.currentMetrics.resistance, '')}
            style={styles.secondaryMetricTile}
          />
          <MetricTile
            label="Bike"
            value={bikeConnected ? 'Connected' : 'Disconnected'}
            style={styles.secondaryMetricTile}
          />
          <MetricTile
            label="HR Source"
            value={hrConnected ? 'Connected' : 'Disconnected'}
            style={styles.secondaryMetricTile}
          />
        </View>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  primaryMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryMetricTile: {
    minWidth: 150,
    flexBasis: 150,
  },
  secondaryMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  secondaryMetricTile: {
    minWidth: 150,
    flexBasis: 150,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
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
