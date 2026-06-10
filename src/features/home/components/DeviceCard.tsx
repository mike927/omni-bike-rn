import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '../../../ui/components/StatusPill';
import { deviceStatusLabel, type DeviceStatus } from '../../../types/deviceStatus';
import { noir } from '../../../ui/theme';

export interface DeviceCardProps {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly name: string;
  readonly kind: string;
  readonly status: DeviceStatus;
  /** Dim the icon + name when the source is not set up / off. */
  readonly muted?: boolean;
  readonly testID?: string;
}

export function DeviceCard({ icon, name, kind, status, muted = false, testID }: DeviceCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={[styles.iconBox, muted && styles.iconBoxMuted]}>
        <Ionicons name={icon} size={22} color={muted ? noir.ink3 : noir.indigoSoft} />
      </View>
      <View style={styles.meta}>
        <Text style={[styles.name, muted && styles.nameMuted]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.kind} numberOfLines={1}>
          {kind}
        </Text>
      </View>
      <StatusPill status={status} scheme="noir" accessibilityLabel={`${name}: ${deviceStatusLabel(status)}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: noir.card3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxMuted: { backgroundColor: noir.iconBox },
  meta: { flex: 1, minWidth: 0 },
  name: { color: noir.ink, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  nameMuted: { color: noir.ink3 },
  kind: { color: noir.ink3, fontSize: 12.5, marginTop: 2 },
});
