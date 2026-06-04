import { StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '../../../ui/components/StatusPill';
import { deviceStatusLabel, type DeviceStatus } from '../../../types/deviceStatus';
import { noir } from '../../../ui/theme';

interface DeviceLine {
  readonly name: string;
  readonly status: DeviceStatus;
}

export interface ConnectionFooterProps {
  readonly bike: DeviceLine;
  readonly hr: DeviceLine;
}

function Row({ eyebrow, device }: { readonly eyebrow: string; readonly device: DeviceLine }) {
  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {device.name}
        </Text>
      </View>
      <StatusPill
        status={device.status}
        scheme="noir"
        accessibilityLabel={`${device.name}: ${deviceStatusLabel(device.status)}`}
      />
    </View>
  );
}

export function ConnectionFooter({ bike, hr }: ConnectionFooterProps) {
  return (
    <View style={styles.card}>
      <Row eyebrow="Smart Bike" device={bike} />
      <View style={styles.divider} />
      <Row eyebrow="Heart Rate" device={hr} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  meta: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: noir.ink3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  name: { marginTop: 3, color: noir.ink, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  divider: { height: 1, backgroundColor: noir.hairline },
});
