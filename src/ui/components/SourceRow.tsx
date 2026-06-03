import { StyleSheet, Text, View } from 'react-native';

import { deviceStatusLabel, type DeviceStatus } from '../../types/deviceStatus';
import { palette } from '../theme';
import { StatusPill } from './StatusPill';

export interface SourceRowProps {
  /** Left-hand category label, e.g. "Bluetooth HR" / "Apple Watch" / a bike name. */
  readonly label: string;
  /** Optional device name shown as a sub-line beneath the label. */
  readonly deviceName?: string;
  readonly status: DeviceStatus;
  /** Render a leading hairline divider (used between rows in multi-source cards). */
  readonly showDivider?: boolean;
}

export function SourceRow({ label, deviceName, status, showDivider = false }: SourceRowProps) {
  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.label}>{label}</Text>
          {deviceName ? (
            <Text style={styles.deviceName} numberOfLines={1}>
              {deviceName}
            </Text>
          ) : null}
        </View>
        <StatusPill status={status} accessibilityLabel={`${label}: ${deviceStatusLabel(status)}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  info: { flexShrink: 1, minWidth: 0, gap: 3 },
  label: { color: palette.textMuted, fontSize: 13, fontWeight: '600' },
  deviceName: { color: palette.textSoft, fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: palette.border, marginBottom: 12 },
});
