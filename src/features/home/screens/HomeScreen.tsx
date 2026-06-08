import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { bleDeviceStatus } from '../../../types/deviceStatus';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { useWatchHrControls } from '../../gear/hooks/useWatchHrControls';
import { watchHrStatus } from '../../../services/hr/hrStatus';
import { InterruptedSessionCard } from '../components/InterruptedSessionCard';
import { DeviceCard } from '../components/DeviceCard';
import { HomeHeader } from '../components/HomeHeader';
import { LatestRideCard } from '../components/LatestRideCard';
import { RideHero } from '../components/RideHero';
import { useLatestWorkout } from '../../training/hooks/useLatestWorkout';
import { useInterruptedSession } from '../../training/hooks/useInterruptedSession';
import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../training/navigation/trainingSummaryRoute';
import { useTrainingSession } from '../../training/hooks/useTrainingSession';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { noir } from '../../../ui/theme';
import { deriveHeader, deriveRideHero } from './homeViewModel';

const SETTINGS_ROUTE = '/(tabs)/settings';

export function HomeScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { interruptedSession, resumeInterruptedSession, discardInterruptedSession } = useInterruptedSession();
  const { bikeConnected, hrConnected, watchAvailability } = useDeviceConnection();
  const { watchAvailable, effectivePrimary } = useWatchHrControls();
  const { savedBike, savedHrSource } = useSavedGear();
  const { bikeReconnectState, hrReconnectState } = useAutoReconnect();
  const latestWorkout = useLatestWorkout();

  const latestWorkoutTimestamp = latestWorkout?.endedAtMs ?? latestWorkout?.startedAtMs ?? null;

  const hero = deriveRideHero({
    phase: session.phase,
    hasSavedBike: savedBike !== null,
    bikeConnected,
    reconnecting: bikeReconnectState === 'connecting',
    bikeName: savedBike?.name ?? null,
    hrName: savedHrSource?.name ?? null,
  });
  const header = deriveHeader({ hasSavedBike: savedBike !== null, bikeConnected });

  const handleHeroPress = () => {
    if (hero.route) {
      router.push(hero.route);
    }
  };

  const viewLatestWorkoutSummary = () => {
    if (!latestWorkout) return;
    router.push(buildTrainingSummaryRoute(latestWorkout.id, SAVED_SESSION_TRAINING_SUMMARY_SOURCE, '/'));
  };

  const handleResumeInterruptedSession = () => {
    if (resumeInterruptedSession()) {
      router.push('/training');
    }
  };

  const handleDiscardInterruptedSession = () => {
    if (!interruptedSession) return;
    Alert.alert(
      'Discard Interrupted Session',
      'This interrupted workout and its saved samples will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => discardInterruptedSession() },
      ],
    );
  };

  const bikeStatus = bleDeviceStatus({
    hasSavedDevice: savedBike !== null,
    connected: bikeConnected,
    reconnect: bikeReconnectState,
  });
  const hrStatus = savedHrSource
    ? bleDeviceStatus({ hasSavedDevice: true, connected: hrConnected, reconnect: hrReconnectState })
    : 'notSetUp';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HomeHeader greeting={header.greeting} subline={header.subline} />

        {interruptedSession ? (
          <InterruptedSessionCard
            session={interruptedSession}
            onResume={handleResumeInterruptedSession}
            onDiscard={handleDiscardInterruptedSession}
          />
        ) : null}

        <RideHero
          kicker={hero.kicker}
          title={hero.title}
          subline={hero.subline}
          variant={hero.variant}
          disabled={hero.disabled}
          onPress={handleHeroPress}
          testID="ride-hero"
        />

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Connected</Text>
          <Text
            style={styles.sectionLink}
            accessibilityRole="button"
            accessibilityLabel="Manage connected gear"
            onPress={() => router.push(SETTINGS_ROUTE)}>
            Manage
          </Text>
        </View>
        <View style={styles.devices}>
          <DeviceCard
            icon="bicycle"
            name={savedBike?.name ?? 'No bike yet'}
            kind="Smart Bike"
            status={bikeStatus}
            muted={savedBike === null}
            testID="device-bike"
          />
          <DeviceCard
            icon="heart"
            name={savedHrSource?.name ?? 'No strap yet'}
            kind="Heart Rate · Chest strap"
            status={hrStatus}
            muted={savedHrSource === null}
            testID="device-hr"
          />
          {watchAvailable ? (
            <DeviceCard
              icon="watch"
              name="Apple Watch"
              kind="Heart Rate · Secondary source"
              status={watchHrStatus(effectivePrimary === 'watch', watchAvailability ?? 'unavailable')}
              muted={effectivePrimary !== 'watch'}
              testID="device-watch"
            />
          ) : null}
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Latest ride</Text>
          {latestWorkout ? (
            <Text
              style={styles.sectionLink}
              accessibilityRole="button"
              accessibilityLabel="View workout history"
              onPress={() => router.push('/(tabs)/history')}>
              History
            </Text>
          ) : null}
        </View>
        <LatestRideCard
          workout={latestWorkout}
          timestampMs={latestWorkoutTimestamp}
          onViewSummary={viewLatestWorkoutSummary}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: noir.bg },
  content: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 32, gap: 14 },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: { color: noir.ink, fontSize: 14, fontWeight: '700' },
  sectionLink: { color: noir.indigoSoft, fontSize: 13, fontWeight: '600' },
  devices: { gap: 10 },
});
