import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

export function SettingsScreen() {
  const router = useRouter();
  const { bikeConnected, hrConnected, disconnectAll } = useDeviceConnection();
  const { savedBike, savedHrSource, forgetBike, forgetHr } = useSavedGear();

  const handleDisconnect = async () => {
    try {
      await disconnectAll({ suppressAutoReconnect: true });
      Alert.alert('Disconnected', 'Cleared the active bike and heart-rate connections.');
    } catch (err: unknown) {
      console.error('[SettingsScreen] Disconnect error:', err);
      Alert.alert('Disconnect Failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AppScreen title="Settings" subtitle="Manage your saved gear and active connections.">
      <SectionCard title="My Gear">
        <View style={styles.gearRow}>
          <View style={styles.gearInfo}>
            <Text style={styles.gearLabel}>Bike</Text>
            <Text style={styles.gearName}>{savedBike ? savedBike.name : 'Not set'}</Text>
          </View>
          <View style={styles.gearActions}>
            <ActionButton
              label={savedBike ? 'Replace' : 'Set Up'}
              onPress={() => router.push('/gear-setup?target=bike')}
              variant="secondary"
            />
            {savedBike ? <ActionButton label="Forget" onPress={() => void forgetBike()} variant="danger" /> : null}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.gearRow}>
          <View style={styles.gearInfo}>
            <Text style={styles.gearLabel}>Heart Rate</Text>
            <Text style={styles.gearName}>{savedHrSource ? savedHrSource.name : 'Not set'}</Text>
          </View>
          <View style={styles.gearActions}>
            <ActionButton
              label={savedHrSource ? 'Replace' : 'Add HR Source'}
              onPress={() => router.push('/gear-setup?target=hr')}
              variant="secondary"
            />
            {savedHrSource ? <ActionButton label="Forget" onPress={() => void forgetHr()} variant="danger" /> : null}
          </View>
        </View>

        <ActionButton
          label="Disconnect Active Gear"
          onPress={() => void handleDisconnect()}
          variant="danger"
          disabled={!bikeConnected && !hrConnected}
        />
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  gearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  gearInfo: {
    flex: 1,
    gap: 2,
  },
  gearLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gearName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  gearActions: {
    flexDirection: 'row',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
});
