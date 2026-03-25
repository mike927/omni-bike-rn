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

export function TrainingDashboardScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { bikeConnected, hrConnected, latestHr } = useDeviceConnection();

  return (
    <AppScreen
      title="Training"
      subtitle="This dedicated route replaces the old one-screen prototype and gives the training flow its own focused surface.">
      <SectionCard title="Workout Status">
        <View style={styles.metricGrid}>
          <MetricTile label="Phase" value={session.phase} style={styles.metricTile} />
          <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
          <MetricTile label="Distance" value={formatDistanceKm(session.totalDistance)} style={styles.metricTile} />
          <MetricTile label="Calories" value={`${session.totalCalories.toFixed(1)} kcal`} style={styles.metricTile} />
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
            <ActionButton label="View Summary" onPress={() => router.push('/summary')} />
          ) : null}
        </View>
        {session.phase === TrainingPhase.Idle && !bikeConnected ? (
          <Text style={styles.helperText}>Connect your bike before starting a workout.</Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Live Metrics">
        <View style={styles.metricGrid}>
          <MetricTile
            label="Speed"
            value={`${session.currentMetrics.speed.toFixed(1)} km/h`}
            style={styles.metricTile}
          />
          <MetricTile label="Cadence" value={`${session.currentMetrics.cadence} rpm`} style={styles.metricTile} />
          <MetricTile label="Power" value={`${session.currentMetrics.power} W`} style={styles.metricTile} />
          <MetricTile
            label="Heart Rate"
            value={formatMetricValue(session.currentMetrics.heartRate ?? latestHr, ' bpm')}
            style={styles.metricTile}
          />
          <MetricTile
            label="Resistance"
            value={formatMetricValue(session.currentMetrics.resistance, '')}
            style={styles.metricTile}
          />
        </View>
      </SectionCard>

      <SectionCard title="Connected Sources">
        <View style={styles.metricGrid}>
          <MetricTile label="Bike" value={bikeConnected ? 'Connected' : 'Disconnected'} style={styles.metricTile} />
          <MetricTile label="HR Source" value={hrConnected ? 'Connected' : 'Disconnected'} style={styles.metricTile} />
        </View>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricTile: {
    minWidth: 150,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
