import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTrainingSession } from '../hooks/useTrainingSession';
import { TrainingPhase } from '../../../types/training';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

export function TrainingSummaryScreen() {
  const router = useRouter();
  const session = useTrainingSession();

  const isEmptySummary =
    session.phase === TrainingPhase.Idle &&
    session.elapsedSeconds === 0 &&
    session.totalDistance === 0 &&
    session.totalCalories === 0;

  const handleDone = () => {
    session.reset();
    router.replace('/');
  };

  return (
    <AppScreen
      title="Summary"
      subtitle="This dedicated screen is ready in the navigation shell, while the final save and upload actions are still planned for later phases.">
      {isEmptySummary ? (
        <SectionCard title="No Workout Yet">
          <Text style={styles.bodyText}>
            Start a session from the training screen to populate the summary view. The route exists now so the shell
            already matches the product flow.
          </Text>
          <ActionButton label="Go to Training" onPress={() => router.push('/training')} />
        </SectionCard>
      ) : (
        <SectionCard title="Workout Totals">
          <View style={styles.metricGrid}>
            <MetricTile label="Phase" value={session.phase} style={styles.metricTile} />
            <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
            <MetricTile label="Distance" value={formatDistanceKm(session.totalDistance)} style={styles.metricTile} />
            <MetricTile label="Calories" value={`${session.totalCalories.toFixed(1)} kcal`} style={styles.metricTile} />
          </View>
        </SectionCard>
      )}

      <SectionCard title="Last Sample">
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
            value={formatMetricValue(session.currentMetrics.heartRate, ' bpm')}
            style={styles.metricTile}
          />
        </View>
      </SectionCard>

      <SectionCard title="Next Planned Work">
        <Text style={styles.bodyText}>
          Save, export, upload, and confirmation behavior will be layered onto this screen once session persistence and
          integrations are implemented.
        </Text>
        <View style={styles.actionRow}>
          {session.phase === TrainingPhase.Finished ? (
            <ActionButton label="Done" onPress={handleDone} />
          ) : (
            <ActionButton label="Back Home" onPress={() => router.replace('/')} variant="secondary" />
          )}
        </View>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
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
});
