import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { POST_FINISH_TRAINING_SUMMARY_SOURCE, type TrainingSummarySource } from '../navigation/trainingSummaryRoute';
import { deleteSession, getSessionById } from '../../../services/db/trainingSessionRepository';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

const HOME_ROUTE = '/';

interface TrainingSummaryScreenProps {
  sessionId: string;
  source: TrainingSummarySource;
  returnTo: string | null;
}

export function TrainingSummaryScreen({ sessionId, source, returnTo }: TrainingSummaryScreenProps) {
  const router = useRouter();
  const [session, setSession] = useState<PersistedTrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isPostFinishSource = source === POST_FINISH_TRAINING_SUMMARY_SOURCE;
  const primaryActionLabel = isPostFinishSource ? 'Save' : 'Done';
  const exitRoute = returnTo ?? HOME_ROUTE;

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const loaded = getSessionById(sessionId);
    setSession(loaded);
    setIsLoading(false);
  }, [sessionId]);

  const handleDiscard = () => {
    Alert.alert('Discard Workout', 'This workout will be permanently deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          try {
            deleteSession(sessionId);
          } catch (err: unknown) {
            console.error('[TrainingSummaryScreen] Failed to delete session:', err);
          }
          router.replace(HOME_ROUTE);
        },
      },
    ]);
  };

  const handlePrimaryAction = () => {
    router.replace(exitRoute);
  };

  if (isLoading) {
    return (
      <AppScreen title="Summary" subtitle="Loading workout data...">
        <SectionCard title="Loading...">
          <Text style={styles.bodyText}>Retrieving your workout from the database.</Text>
        </SectionCard>
      </AppScreen>
    );
  }

  if (!session) {
    return (
      <AppScreen title="Summary" subtitle="No workout found for this session.">
        <SectionCard title="Workout Not Found">
          <Text style={styles.bodyText}>
            The requested workout could not be found. It may have been discarded or the session was not saved.
          </Text>
          <ActionButton label="Back Home" onPress={() => router.replace(HOME_ROUTE)} />
        </SectionCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen title="Summary" subtitle="Review your workout results.">
      <View style={styles.screenContent}>
        <SectionCard title="Workout Totals">
          <View style={styles.metricGrid}>
            <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
            <MetricTile
              label="Distance"
              value={formatDistanceKm(session.totalDistanceMeters)}
              style={styles.metricTile}
            />
            <MetricTile
              label="Calories"
              value={`${session.totalCaloriesKcal.toFixed(1)} kcal`}
              style={styles.metricTile}
            />
          </View>
        </SectionCard>

        <SectionCard title="Final Metrics">
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

        <View style={styles.actionRow}>
          <ActionButton label="Discard" onPress={handleDiscard} variant="danger" />
          <ActionButton label={primaryActionLabel} onPress={handlePrimaryAction} />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 16,
  },
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
