import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useLatestWorkout } from '../../training/hooks/useLatestWorkout';
import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../training/navigation/trainingSummaryRoute';
import { useTrainingSession } from '../../training/hooks/useTrainingSession';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

const HISTORY_ROUTE = '/history';

export function HistoryScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const latestWorkout = useLatestWorkout();

  return (
    <AppScreen
      title="History"
      subtitle="This tab is now part of the shell, with a lightweight placeholder until persistence and the real workout list arrive in Phase 5.">
      <SectionCard
        title="Coming Next"
        description="Session persistence, saved workouts, and per-ride detail views are still ahead in the roadmap.">
        <Text style={styles.bodyText}>
          For now, this screen gives the app a stable tab destination and a place to surface the current in-memory
          workout snapshot.
        </Text>
      </SectionCard>

      <SectionCard title="Current Session Snapshot">
        <View style={styles.metricGrid}>
          <MetricTile label="Phase" value={session.phase} style={styles.metricTile} />
          <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
          <MetricTile label="Distance" value={formatDistanceKm(session.totalDistance)} style={styles.metricTile} />
        </View>
        <ActionButton
          label="Open Latest Summary"
          onPress={() => {
            if (latestWorkout) {
              router.push(
                buildTrainingSummaryRoute(latestWorkout.id, SAVED_SESSION_TRAINING_SUMMARY_SOURCE, HISTORY_ROUTE),
              );
            }
          }}
          variant="secondary"
          disabled={!latestWorkout}
        />
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
});
