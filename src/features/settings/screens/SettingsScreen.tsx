import { Alert, StyleSheet, Text, View } from 'react-native';

import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

export function SettingsScreen() {
  const { bikeConnected, hrConnected, latestBikeMetrics, latestHr, disconnectAll } = useDeviceConnection();

  const handleDisconnect = async () => {
    try {
      await disconnectAll();
      Alert.alert('Disconnected', 'Cleared the active bike and heart-rate connections.');
    } catch (err: unknown) {
      console.error('[SettingsScreen] Disconnect error:', err);
      Alert.alert('Disconnect Failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AppScreen
      title="Settings"
      subtitle="The shell now includes a stable settings destination. Device preferences, permissions, and saved gear management will expand here next.">
      <SectionCard title="Connection Status">
        <View style={styles.metricGrid}>
          <MetricTile label="Bike" value={bikeConnected ? 'Connected' : 'Not connected'} style={styles.metricTile} />
          <MetricTile
            label="Heart Rate"
            value={hrConnected ? 'Connected' : 'Not connected'}
            style={styles.metricTile}
          />
          <MetricTile
            label="Bike Power"
            value={latestBikeMetrics ? `${latestBikeMetrics.power} W` : '--'}
            style={styles.metricTile}
          />
          <MetricTile label="Latest HR" value={formatMetricValue(latestHr, ' bpm')} style={styles.metricTile} />
        </View>
        <ActionButton
          label="Disconnect Active Gear"
          onPress={handleDisconnect}
          variant="danger"
          disabled={!bikeConnected && !hrConnected}
        />
      </SectionCard>

      <SectionCard title="Upcoming Settings Work">
        <Text style={styles.bodyText}>
          Saved-bike preferences, reconnect actions, and just-in-time Bluetooth permission messaging are intentionally
          deferred to later Phase 2 plan items.
        </Text>
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
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
