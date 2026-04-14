import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
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
import { formatDistanceKm, formatDuration } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import type { ReconnectState } from '../../../types/gear';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

const TRAINING_ROUTE = '/training';
const BIKE_SETUP_ROUTE = '/gear-setup?target=bike';
const HR_SETUP_ROUTE = '/gear-setup?target=hr';

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
  if (state === 'connecting') return 'Connecting...';
  if (state === 'connected') return 'Connected';
  if (state === 'failed') return 'Connection failed';
  if (state === 'disconnected') return 'Not connected';
  return 'Not connected';
}

function renderSavedGearActions(
  hasSavedGear: boolean,
  reconnectState: ReconnectState,
  setupLabel: string,
  setupRoute: string,
  retry: () => void,
  forget: () => void,
  onNavigate: (route: string) => void,
): ReactNode {
  if (!hasSavedGear) {
    return <ActionButton label={setupLabel} onPress={() => onNavigate(setupRoute)} variant="secondary" />;
  }

  if (reconnectState === 'connecting') {
    return (
      <>
        <ActionButton label="Reconnecting..." onPress={retry} variant="secondary" disabled />
        <ActionButton label="Forget" onPress={forget} variant="danger" />
      </>
    );
  }

  if (reconnectState === 'failed' || reconnectState === 'disconnected') {
    return (
      <>
        <ActionButton label="Retry" onPress={retry} variant="secondary" />
        <ActionButton label="Choose Another" onPress={() => onNavigate(setupRoute)} variant="secondary" />
        <ActionButton label="Forget" onPress={forget} variant="danger" />
      </>
    );
  }

  return null;
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
  const { bikeConnected, hrConnected } = useDeviceConnection();
  const { savedBike, savedHrSource, forgetBike, forgetHr } = useSavedGear();
  const { bikeReconnectState, hrReconnectState, retryBike, retryHr } = useAutoReconnect();
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

      <SectionCard title="Quick Start" description="Begin a workout as soon as your main bike is connected.">
        <ActionButton
          label={getTrainingButtonLabel(session.phase)}
          onPress={() => router.push(TRAINING_ROUTE)}
          disabled={!isTrainingEnabled}
          fullWidth
        />
        {bikeConnected ? null : (
          <Text style={styles.helperText}>Quick Start stays disabled until your saved bike is connected.</Text>
        )}
      </SectionCard>

      <SectionCard title="Bike" description={savedBike ? savedBike.name : 'No bike saved yet.'}>
        <Text style={styles.statusText}>
          Status: {bikeConnected ? 'Connected' : reconnectLabel(bikeReconnectState)}
        </Text>
        <View style={styles.actionRow}>
          {renderSavedGearActions(
            savedBike !== null,
            bikeReconnectState,
            'Set Up Bike',
            BIKE_SETUP_ROUTE,
            retryBike,
            () => void forgetBike(),
            router.push,
          )}
        </View>
      </SectionCard>

      <SectionCard
        title="HR Source"
        description={
          savedHrSource
            ? savedHrSource.name
            : 'No Bluetooth HR source saved. Chest straps and broadcast watches are optional.'
        }>
        <Text style={styles.statusText}>Status: {hrConnected ? 'Connected' : reconnectLabel(hrReconnectState)}</Text>
        <View style={styles.actionRow}>
          {renderSavedGearActions(
            savedHrSource !== null,
            hrReconnectState,
            'Add Bluetooth HR',
            HR_SETUP_ROUTE,
            retryHr,
            () => void forgetHr(),
            router.push,
          )}
        </View>
      </SectionCard>

      <SectionCard title="Latest Workout">
        {renderLatestWorkoutContent(latestWorkout, latestWorkoutTimestamp, viewLatestWorkoutSummary)}
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
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
