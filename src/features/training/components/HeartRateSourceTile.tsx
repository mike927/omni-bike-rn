import { StyleSheet, Text, View } from 'react-native';

import type { DeviceStatus } from '../../../types/deviceStatus';
import { StatusPill } from '../../../ui/components/StatusPill';
import { palette } from '../../../ui/theme';

export interface HeartRateSourceTileProps {
  readonly name: string;
  readonly status: DeviceStatus | null;
}

export function HeartRateSourceTile({ name, status }: HeartRateSourceTileProps) {
  return (
    <View style={styles.card} testID="hr-source-tile">
      <Text style={styles.label}>Heart Rate Source</Text>
      <Text style={styles.value} numberOfLines={1}>
        {name}
      </Text>
      {status === null ? null : (
        <View style={styles.status}>
          <StatusPill status={status} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: { color: palette.text, fontSize: 15, fontWeight: '700' },
  status: { marginTop: 2 },
});
