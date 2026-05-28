import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text } from 'react-native';

import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { bleDeviceStatus } from '../../../services/status/deviceStatus';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { useWatchHrControls } from '../../gear/hooks/useWatchHrControls';
import { hrSourceIdleReadiness, watchHrStatus } from '../../../services/hr/hrStatus';
import { InterruptedSessionCard } from '../components/InterruptedSessionCard';
import { useLatestWorkout } from '../../training/hooks/useLatestWorkout';
import { useInterruptedSession } from '../../training/hooks/useInterruptedSession';
import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../training/navigation/trainingSummaryRoute';
import { useTrainingSession } from '../../training/hooks/useTrainingSession';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { TrainingPhase } from '../../../types/training';
import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { SourceRow } from '../../../ui/components/SourceRow';
import { formatDistanceKm, formatDuration } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

const TRAINING_ROUTE = '/training';
const SETTINGS_ROUTE = '/(tabs)/settings';

function getTrainingButtonLabel(phase: TrainingPhase): string {
  if (phase === TrainingPhase.Active || phase === TrainingPhase.Paused) {
    return 'Resume Training';
  }

  return 'Start Training';
}

function canOpenTraining(phase: TrainingPhase, bikeConnected: boolean): boolean {
  return bikeConnected && phase !== TrainingPhase.Finished;
}

function renderLatestWorkoutContent(
  latestWorkout: PersistedTrainingSession | null,
  latestWorkoutTimestamp: number | null,
  onViewSummary: () => void,
): ReactNode {
  if (!latestWorkout || latestWorkoutTimestamp === null) {
    return <Text style={styles.bodyText}>Complete a ride to see your latest workout summary here.</Text>;
  }

  return (
    <>
      <Text style={styles.bodyText}>
        {new Date(latestWorkoutTimestamp).toLocaleDateString()} • {formatDuration(latestWorkout.elapsedSeconds)}
      </Text>
      <Text style={styles.bodyText}>
        {formatDistanceKm(latestWorkout.totalDistanceMeters)} • {latestWorkout.totalCaloriesKcal.toFixed(1)} kcal
      </Text>
      <ActionButton label="View Summary" onPress={onViewSummary} variant="secondary" />
    </>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { interruptedSession, resumeInterruptedSession, discardInterruptedSession } = useInterruptedSession();
  const { bikeConnected, hrConnected, watchAvailability } = useDeviceConnection();
  const { watchAvailable, effectivePrimary } = useWatchHrControls();
  const { savedBike, savedHrSource } = useSavedGear();
  const { bikeReconnectState, hrReconnectState } = useAutoReconnect();
  const latestWorkout = useLatestWorkout();

  const isTrainingEnabled = canOpenTraining(session.phase, bikeConnected);
  const latestWorkoutTimestamp = latestWorkout?.endedAtMs ?? latestWorkout?.startedAtMs ?? null;
  const viewLatestWorkoutSummary = () => {
    if (!latestWorkout) {
      return;
    }

    router.push(buildTrainingSummaryRoute(latestWorkout.id, SAVED_SESSION_TRAINING_SUMMARY_SOURCE, '/'));
  };

  const handleResumeInterruptedSession = () => {
    if (resumeInterruptedSession()) {
      router.push(TRAINING_ROUTE);
    }
  };

  const handleDiscardInterruptedSession = () => {
    if (!interruptedSession) {
      return;
    }

    Alert.alert(
      'Discard Interrupted Session',
      'This interrupted workout and its saved samples will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            discardInterruptedSession();
          },
        },
      ],
    );
  };

  return (
    <AppScreen title="Home" subtitle="Start a ride, reconnect your saved gear, or jump back into your latest summary.">
      {interruptedSession ? (
        <InterruptedSessionCard
          session={interruptedSession}
          onResume={handleResumeInterruptedSession}
          onDiscard={handleDiscardInterruptedSession}
        />
      ) : null}

      <SectionCard title="Quick Start" description="Begin a workout as soon as your main Smart Bike is connected.">
        <ActionButton
          label={getTrainingButtonLabel(session.phase)}
          onPress={() => router.push(TRAINING_ROUTE)}
          disabled={!isTrainingEnabled}
          fullWidth
        />
        {bikeConnected ? null : (
          <Text style={styles.helperText}>Quick Start stays disabled until your saved Smart Bike is connected.</Text>
        )}
      </SectionCard>

      <SectionCard title="Smart Bike" onPress={() => router.push(SETTINGS_ROUTE)}>
        <SourceRow
          label={savedBike ? savedBike.name : 'Not set'}
          status={bleDeviceStatus({
            hasSavedDevice: savedBike !== null,
            connected: bikeConnected,
            reconnect: bikeReconnectState,
          })}
        />
      </SectionCard>

      <SectionCard title="Heart Rate" onPress={() => router.push(SETTINGS_ROUTE)}>
        <SourceRow
          label="Bluetooth HR"
          deviceName={savedHrSource?.name}
          status={
            savedHrSource
              ? bleDeviceStatus({ hasSavedDevice: true, connected: hrConnected, reconnect: hrReconnectState })
              : 'notSetUp'
          }
        />
        {watchAvailable ? (
          <SourceRow
            showDivider
            label="Apple Watch"
            status={watchHrStatus(effectivePrimary === 'watch', watchAvailability ?? 'unavailable')}
          />
        ) : null}
        {effectivePrimary === 'bike' ? (
          <SourceRow
            showDivider
            label="Bike pulse"
            status={hrSourceIdleReadiness({
              source: 'bike',
              watchAvailability: watchAvailability ?? 'unavailable',
              hrConnected,
              bikeConnected,
            })}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Latest Workout">
        {renderLatestWorkoutContent(latestWorkout, latestWorkoutTimestamp, viewLatestWorkoutSummary)}
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
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
