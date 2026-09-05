import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceConnection } from '../hooks/useDeviceConnection';
import { useTrainingSession } from '../hooks/useTrainingSession';
import { usePowerTrend } from '../hooks/usePowerTrend';
import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { bleDeviceStatus } from '../../../types/deviceStatus';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { POST_FINISH_HOME_ROUTE, resolvePostFinishRoute } from '../navigation/trainingSummaryRoute';
import { resolveHrSourceSummary } from '../../../services/hr/hrStatus';
import { resolveHrReading } from '../../../services/hr/hrSource';
import { useEffectiveHrSource } from '../../../services/hr/useEffectiveHrSource';
import { useDeviceConnectionStore } from '../../../store/deviceConnectionStore';
import { useSessionPersistenceStore } from '../../../store/sessionPersistenceStore';
import { ConnectionFooter } from '../components/ConnectionFooter';
import { DisconnectedCallout } from '../components/DisconnectedCallout';
import { RideStorageNotice } from '../components/RideStorageNotice';
import { FeatureMetricCard } from '../components/FeatureMetricCard';
import { PowerTrend } from '../components/PowerTrend';
import { RideControls } from '../components/RideControls';
import { RideTimerCard } from '../components/RideTimerCard';
import { SecondaryMetricsRow } from '../components/SecondaryMetricsRow';
import { deriveStorageNotice, deriveTrainingView } from './trainingViewModel';
import { noir } from '../../../ui/theme';
import { logWc } from '../../../services/watch/wcLog';

const HOME_ROUTE = POST_FINISH_HOME_ROUTE;
const BIKE_SETUP_ROUTE = '/gear-setup?target=bike';

export function TrainingDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useTrainingSession();
  const {
    bikeConnected,
    hrConnected,
    latestBluetoothHr,
    latestAppleWatchHr,
    lastAppleWatchSampleAtMs,
    watchAvailability,
  } = useDeviceConnection();
  const { savedBike, savedHrSource } = useSavedGear();
  const { bikeReconnectState } = useAutoReconnect();
  const [isFinishing, setIsFinishing] = useState(false);

  const activeHrSource = useDeviceConnectionStore((s) => s.activeHrSource);
  const lastBluetoothHrSampleAtMs = useDeviceConnectionStore((s) => s.lastBluetoothHrSampleAtMs);

  // Where this ride stands on disk. Read from the store rather than from the
  // Finish call, so a ride ended from the wrist shows the same recovery state.
  const persistenceStatus = useSessionPersistenceStore((s) => s.status);
  const droppedSampleCount = useSessionPersistenceStore((s) => s.droppedSampleCount);

  const savedHrName = savedHrSource?.name ?? null;

  // Single shared reactive hook: session-locked source → user-configured primary → hardware default.
  const effectiveHrSource = useEffectiveHrSource();

  const reading = resolveHrReading({
    activeSource: effectiveHrSource,
    latestAppleWatchHr: latestAppleWatchHr ?? null,
    lastAppleWatchSampleAtMs: lastAppleWatchSampleAtMs ?? null,
    latestBluetoothHr: latestBluetoothHr ?? null,
    lastBluetoothHrSampleAtMs: lastBluetoothHrSampleAtMs ?? null,
    nowMs: Date.now(),
  });

  // effectiveHrSource may be null when no HR source is available; the summary
  // renders that as "Heart rate · Not set up".
  const hrSummary = resolveHrSourceSummary({
    activeHrSource,
    reading,
    primaryHrSource: effectiveHrSource,
    watchAvailability: watchAvailability ?? 'unavailable',
    savedHrName,
    hrConnected,
    phase: session.phase,
    elapsedSeconds: session.elapsedSeconds,
  });

  // Diagnostic: log every HR-tile status transition so the in-workout state machine
  // (connecting → ready → paused → noSignal) is verifiable from the [WC-JS] stream
  // on-device, not by eye. Fires only on a status/name change.
  const hrTileName = hrSummary.name;
  const hrTileStatus = hrSummary.status;
  useEffect(() => {
    logWc(`[hrTile] ${hrTileName} -> ${hrTileStatus}`);
  }, [hrTileName, hrTileStatus]);

  const bikeStatus = bleDeviceStatus({
    hasSavedDevice: savedBike !== null,
    connected: bikeConnected,
    reconnect: bikeReconnectState,
  });

  const powerSamples = usePowerTrend(session.currentMetrics.power, session.phase, session.elapsedSeconds);

  const vm = deriveTrainingView({
    phase: session.phase,
    bikeConnected,
    elapsedSeconds: session.elapsedSeconds,
    power: session.currentMetrics.power,
    heartRate: session.currentMetrics.heartRate ?? null,
    speed: session.currentMetrics.speed,
    cadence: session.currentMetrics.cadence,
    totalDistanceMeters: session.totalDistance,
    totalCalories: session.totalCalories,
  });

  const storageNotice = deriveStorageNotice({
    phase: session.phase,
    status: persistenceStatus,
    droppedSampleCount,
  });

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    try {
      const outcome = await session.finishAndDisconnect();
      if (outcome.status === 'unsaved') {
        // The ride is over and is not on disk. Stay here with it: navigating to
        // a summary or Home would pretend the save worked and lose the ride.
        console.error('[TrainingDashboardScreen] Ride could not be saved:', outcome.message);
        setIsFinishing(false);
        return;
      }

      router.replace(resolvePostFinishRoute(outcome.sessionId));
    } catch (err: unknown) {
      console.error('[TrainingDashboardScreen] Finish failed:', err);
      setIsFinishing(false);
    }
  };

  const handleRetrySave = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    try {
      const outcome = await session.retrySave();
      if (outcome.status === 'unsaved') {
        console.error('[TrainingDashboardScreen] Retrying the ride save failed:', outcome.message);
        setIsFinishing(false);
        return;
      }

      router.replace(resolvePostFinishRoute(outcome.sessionId));
    } catch (err: unknown) {
      console.error('[TrainingDashboardScreen] Retrying the ride save failed:', err);
      setIsFinishing(false);
    }
  };

  const handleDiscardUnsaved = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    try {
      await session.discardUnsaved();
      router.replace(HOME_ROUTE);
    } catch (err: unknown) {
      console.error('[TrainingDashboardScreen] Discarding the unsaved ride failed:', err);
      setIsFinishing(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
          <Ionicons name="chevron-back" size={22} color={noir.ink2} />
        </Pressable>
        <Text style={styles.headerTitle}>Training</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RideTimerCard phaseLabel={vm.phaseLabel} timerText={vm.timerText} live={vm.controls.kind === 'active'} />

        {/* Directly under the timer: a ride that is not being stored, or one that
            finished without being saved, is the first thing the user must see. */}
        <RideStorageNotice
          notice={storageNotice}
          busy={isFinishing}
          onRetrySave={handleRetrySave}
          onDiscard={handleDiscardUnsaved}
        />

        <View style={styles.pairs}>
          <FeatureMetricCard label="Power" value={vm.power.value} unit={vm.power.unit}>
            <PowerTrend samples={powerSamples} />
          </FeatureMetricCard>
          <FeatureMetricCard label="Heart Rate" value={vm.heart.value} unit={vm.heart.unit} accent>
            <Text style={styles.hrSource} numberOfLines={1}>
              {hrSummary.name}
            </Text>
          </FeatureMetricCard>
        </View>

        <SecondaryMetricsRow items={vm.secondary} />

        <ConnectionFooter
          bike={{ name: savedBike?.name ?? 'No bike yet', status: bikeStatus }}
          hr={{ name: hrSummary.name, status: hrSummary.status }}
        />

        {vm.showCallout ? (
          <DisconnectedCallout
            body={vm.calloutBody}
            onSetup={() => router.push(BIKE_SETUP_ROUTE)}
            onHome={() => router.replace(HOME_ROUTE)}
          />
        ) : null}
      </ScrollView>

      {/* An unsaved ride has exactly two next steps, and both live in the notice
          above; a "Finishing..." bar underneath them would be a lie. */}
      <View style={[styles.controlsBar, { paddingBottom: insets.bottom + 14 }]}>
        {storageNotice.kind === 'unsaved' ? null : (
          <RideControls
            controls={vm.controls}
            isFinishing={isFinishing}
            onStart={session.start}
            onPause={session.pause}
            onResume={session.resume}
            onFinish={handleFinish}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: noir.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
  },
  backBtnPressed: { opacity: 0.6 },
  // Blank third navbar cell — balances the back button without painting a card/border.
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { color: noir.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  content: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24, gap: 12 },
  pairs: { flexDirection: 'row', gap: 11 },
  hrSource: { color: noir.mintSoft, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },
  controlsBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: noir.bg,
    borderTopWidth: 1,
    borderTopColor: noir.hairline,
  },
});
