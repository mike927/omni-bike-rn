import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useBleScanner } from '../../devices/hooks/useBleScanner';
import { useTrainingSession } from '../../training/hooks/useTrainingSession';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
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

export function HomeScreen() {
  const router = useRouter();
  const session = useTrainingSession();
  const { devices, isScanning, error, scanForDevices, stopScanning } = useBleScanner();
  const { bikeConnected, hrConnected, latestBikeMetrics, latestHr, connectBike, connectHr } = useDeviceConnection();

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
      subtitle="Phase 2 starts with the app shell. You can scan, connect test gear, and move into the dedicated training and summary routes from here.">
      <SectionCard
        title="Session"
        description="The shell is in place, while the deeper workout finish flow and persistence land in later plan items.">
        <View style={styles.metricGrid}>
          <MetricTile label="Phase" value={session.phase} style={styles.metricTile} />
          <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
          <MetricTile label="Distance" value={formatDistanceKm(session.totalDistance)} style={styles.metricTile} />
          <MetricTile label="Calories" value={`${session.totalCalories.toFixed(1)} kcal`} style={styles.metricTile} />
        </View>
        <View style={styles.actionRow}>
          <ActionButton label="Open Training" onPress={() => router.push('/training')} />
          <ActionButton label="Open Summary" onPress={() => router.push('/summary')} variant="secondary" />
        </View>
      </SectionCard>

      <SectionCard title="My Gear" description="Live connection state from the BLE hooks and Zustand stores.">
        <View style={styles.metricGrid}>
          <MetricTile label="Bike" value={bikeConnected ? 'Connected' : 'Not connected'} style={styles.metricTile} />
          <MetricTile
            label="Heart Rate"
            value={hrConnected ? 'Connected' : 'Not connected'}
            style={styles.metricTile}
          />
          <MetricTile
            label="Latest Speed"
            value={latestBikeMetrics ? `${latestBikeMetrics.speed.toFixed(1)} km/h` : '--'}
            style={styles.metricTile}
          />
          <MetricTile label="Latest HR" value={formatMetricValue(latestHr, ' bpm')} style={styles.metricTile} />
        </View>
      </SectionCard>

      <SectionCard
        title="Scan Nearby Devices"
        description="This keeps the existing BLE smoke-test behavior available until the dedicated gear setup flow is built.">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <ActionButton
          label={isScanning ? 'Stop Scan' : 'Start Scan'}
          onPress={isScanning ? stopScanning : scanForDevices}
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
