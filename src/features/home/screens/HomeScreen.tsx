import { useRouter } from 'expo-router';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { useBlePermission } from '../../devices/hooks/useBlePermission';
import { useBleScanner } from '../../devices/hooks/useBleScanner';
import { useTrainingSession } from '../../training/hooks/useTrainingSession';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { TrainingPhase } from '../../../types/training';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

function inferDeviceType(name: string | null): string {
  const normalizedName = name?.toLowerCase() ?? '';

  if (
    normalizedName.includes('zipro') ||
    normalizedName.includes('rave') ||
    normalizedName.includes('bike') ||
    normalizedName.includes('trainer') ||
    normalizedName.includes('ic')
  ) {
    return 'Bike trainer';
  }

  if (normalizedName.includes('hr') || normalizedName.includes('heart') || normalizedName.includes('garmin')) {
    return 'Heart-rate sensor';
  }

  return 'Unknown device';
}

function getTrainingButtonLabel(phase: TrainingPhase): string {
  if (phase === TrainingPhase.Active || phase === TrainingPhase.Paused) {
    return 'Resume Training';
  }

  return 'Start Training';
}

export function HomeScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { requestBlePermission } = useBlePermission();
  const { devices, isScanning, error, scanForDevices, stopScanning } = useBleScanner();
  const { bikeConnected, hrConnected, latestBikeMetrics, latestHr, connectBike, connectHr } = useDeviceConnection();
  const hasInterruptedSession = session.phase === TrainingPhase.Active || session.phase === TrainingPhase.Paused;
  const canOpenTraining =
    bikeConnected &&
    (session.phase === TrainingPhase.Idle ||
      session.phase === TrainingPhase.Active ||
      session.phase === TrainingPhase.Paused);

  const handleScanPress = async () => {
    const result = await requestBlePermission();
    if (result === 'denied') {
      Alert.alert('Bluetooth Permission Required', 'Allow Omni Bike to access Bluetooth in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    await scanForDevices();
  };

  const handleConnect = async (deviceId: string, name: string | null) => {
    try {
      stopScanning();

      if (inferDeviceType(name) === 'Bike trainer') {
        await connectBike(deviceId);
        Alert.alert('Connected', `Connected to bike: ${name ?? deviceId}`);
        return;
      }

      await connectHr(deviceId);
      Alert.alert('Connected', `Connected to heart-rate source: ${name ?? deviceId}`);
    } catch (err: unknown) {
      console.error('[HomeScreen] Connection error:', err);
      Alert.alert('Connection Failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AppScreen
      title="Ride Setup"
      subtitle="Home is the bike-first setup surface for training, current device readiness, and quick access to the rest of the app shell.">
      <SectionCard
        title="Quick Start"
        description="Start or resume training once the bike is ready, and jump straight to History or Settings from the same surface.">
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
            disabled={!canOpenTraining}
          />
          <ActionButton label="History" onPress={() => router.push('/history')} variant="secondary" />
          <ActionButton label="Settings" onPress={() => router.push('/settings')} variant="secondary" />
        </View>
        {!bikeConnected ? <Text style={styles.helperText}>Connect your bike before starting a workout.</Text> : null}
      </SectionCard>

      <SectionCard
        title="Resume Interrupted Session"
        description="Only the current in-memory active or paused workout can be resumed from Home until persistence arrives in a later phase.">
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

      <SectionCard
        title="My Bike"
        description="Live bike readiness and FTMS samples are surfaced here until the dedicated gear setup flow is implemented.">
        <View style={styles.metricGrid}>
          <MetricTile label="Bike" value={bikeConnected ? 'Connected' : 'Not connected'} style={styles.metricTile} />
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
        <Text style={styles.bodyText}>
          {bikeConnected
            ? 'Bike is connected and ready for training.'
            : 'Scan nearby devices below to connect your bike trainer.'}
        </Text>
      </SectionCard>

      <SectionCard
        title="Heart Rate"
        description="Current live HR readiness stays visible on Home even before preferred-device memory is built.">
        <View style={styles.metricGrid}>
          <MetricTile
            label="Heart Rate"
            value={hrConnected ? 'Connected' : 'Not connected'}
            style={styles.metricTile}
          />
          <MetricTile label="Latest HR" value={formatMetricValue(latestHr, ' bpm')} style={styles.metricTile} />
        </View>
        <Text style={styles.bodyText}>
          {hrConnected
            ? 'Heart-rate source is connected and feeding live data.'
            : 'Connect a heart-rate source from the scan list when available.'}
        </Text>
      </SectionCard>

      <SectionCard
        title="Scan Nearby Devices"
        description="Temporary inline scan and connect behavior stays on Home until the dedicated gear setup flow is implemented.">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <ActionButton
          label={isScanning ? 'Stop Scan' : 'Start Scan'}
          onPress={isScanning ? stopScanning : handleScanPress}
          fullWidth
        />

        {devices.length === 0 ? (
          <Text style={styles.emptyText}>
            {isScanning ? 'Scanning for nearby BLE devices…' : 'No devices discovered yet.'}
          </Text>
        ) : (
          devices.map((device) => {
            const deviceType = inferDeviceType(device.name);

            return (
              <View key={device.id} style={styles.deviceRow}>
                <View style={styles.deviceText}>
                  <Text style={styles.deviceName}>{device.name ?? 'Unknown Device'}</Text>
                  <Text style={styles.deviceMeta}>{deviceType}</Text>
                  <Text style={styles.deviceId}>{device.id}</Text>
                </View>
                <ActionButton label="Connect" onPress={() => handleConnect(device.id, device.name)} variant="ghost" />
              </View>
            );
          })
        )}
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
  errorText: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
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
  deviceRow: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    padding: 14,
  },
  deviceText: {
    gap: 4,
  },
  deviceName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  deviceMeta: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  deviceId: {
    color: palette.textMuted,
    fontSize: 12,
  },
});
