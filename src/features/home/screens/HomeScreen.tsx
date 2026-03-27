import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { useTrainingSession } from '../../training/hooks/useTrainingSession';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { TrainingPhase } from '../../../types/training';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import type { ReconnectState } from '../../../types/gear';

function getTrainingButtonLabel(phase: TrainingPhase): string {
  if (phase === TrainingPhase.Active || phase === TrainingPhase.Paused) {
    return 'Resume Training';
  }
  return 'Start Training';
}

function canOpenTraining(phase: TrainingPhase, bikeConnected: boolean): boolean {
  return bikeConnected && phase !== TrainingPhase.Finished;
}

function reconnectLabel(state: ReconnectState): string {
  if (state === 'connecting') return 'Connecting…';
  if (state === 'connected') return 'Connected';
  if (state === 'failed') return 'Connection failed';
  return 'Not connected';
}

export function HomeScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { bikeConnected, hrConnected, latestBikeMetrics, latestHr } = useDeviceConnection();
  const { savedBike, savedHrSource, forgetBike, forgetHr } = useSavedGear();
  const { bikeReconnectState, hrReconnectState, retryBike, retryHr } = useAutoReconnect();

  const hasInterruptedSession = session.phase === TrainingPhase.Active || session.phase === TrainingPhase.Paused;
  const isTrainingEnabled = canOpenTraining(session.phase, bikeConnected);

  return (
    <AppScreen title="Ride Setup" subtitle="Set up your gear and start training.">
      <SectionCard title="Quick Start">
        <View style={styles.metricGrid}>
          <MetricTile label="Phase" value={session.phase} style={styles.metricTile} />
          <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
          <MetricTile label="Distance" value={formatDistanceKm(session.totalDistance)} style={styles.metricTile} />
          <MetricTile label="Calories" value={`${session.totalCalories.toFixed(1)} kcal`} style={styles.metricTile} />
        </View>
        <View style={styles.actionRow}>
          <ActionButton
            label={getTrainingButtonLabel(session.phase)}
            onPress={() => router.push('/training')}
            disabled={!isTrainingEnabled}
          />
          <ActionButton label="History" onPress={() => router.push('/history')} variant="secondary" />
          <ActionButton label="Settings" onPress={() => router.push('/settings')} variant="secondary" />
        </View>
        {!bikeConnected ? <Text style={styles.helperText}>Connect your bike before starting a workout.</Text> : null}
      </SectionCard>

      <SectionCard title="Resume Interrupted Session">
        {hasInterruptedSession ? (
          <>
            <View style={styles.metricGrid}>
              <MetricTile label="Status" value={session.phase} style={styles.metricTile} />
              <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
              <MetricTile label="Distance" value={formatDistanceKm(session.totalDistance)} style={styles.metricTile} />
            </View>
            <ActionButton label="Resume Workout" onPress={() => router.push('/training')} />
          </>
        ) : (
          <Text style={styles.bodyText}>No interrupted workout is ready to resume right now.</Text>
        )}
      </SectionCard>

      <SectionCard title="My Bike">
        <View style={styles.metricGrid}>
          <MetricTile
            label="Status"
            value={bikeConnected ? 'Connected' : reconnectLabel(bikeReconnectState)}
            style={styles.metricTile}
          />
          <MetricTile
            label="Latest Speed"
            value={latestBikeMetrics ? `${latestBikeMetrics.speed.toFixed(1)} km/h` : '--'}
            style={styles.metricTile}
          />
          <MetricTile
            label="Latest Power"
            value={latestBikeMetrics ? `${latestBikeMetrics.power} W` : '--'}
            style={styles.metricTile}
          />
        </View>
        {savedBike ? (
          <Text style={styles.bodyText}>{savedBike.name}</Text>
        ) : (
          <Text style={styles.bodyText}>No bike saved yet.</Text>
        )}
        <View style={styles.actionRow}>
          {!savedBike ? (
            <ActionButton
              label="Set Up Bike"
              onPress={() => router.push('/gear-setup?target=bike')}
              variant="secondary"
            />
          ) : null}
          {savedBike && bikeReconnectState === 'failed' ? (
            <>
              <ActionButton label="Retry" onPress={retryBike} variant="secondary" />
              <ActionButton
                label="Choose Another"
                onPress={() => router.push('/gear-setup?target=bike')}
                variant="secondary"
              />
              <ActionButton label="Forget" onPress={() => void forgetBike()} variant="danger" />
            </>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Heart Rate">
        <View style={styles.metricGrid}>
          <MetricTile
            label="Status"
            value={hrConnected ? 'Connected' : reconnectLabel(hrReconnectState)}
            style={styles.metricTile}
          />
          <MetricTile label="Latest HR" value={formatMetricValue(latestHr, ' bpm')} style={styles.metricTile} />
        </View>
        {savedHrSource ? (
          <Text style={styles.bodyText}>{savedHrSource.name}</Text>
        ) : (
          <Text style={styles.bodyText}>No HR source saved. HR is optional.</Text>
        )}
        <View style={styles.actionRow}>
          {!savedHrSource ? (
            <ActionButton
              label="Add HR Source"
              onPress={() => router.push('/gear-setup?target=hr')}
              variant="secondary"
            />
          ) : null}
          {savedHrSource && hrReconnectState === 'failed' ? (
            <>
              <ActionButton label="Retry" onPress={retryHr} variant="secondary" />
              <ActionButton
                label="Choose Another"
                onPress={() => router.push('/gear-setup?target=hr')}
                variant="secondary"
              />
              <ActionButton label="Forget" onPress={() => void forgetHr()} variant="danger" />
            </>
          ) : null}
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
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
