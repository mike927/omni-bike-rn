import { StyleSheet, Text, View } from 'react-native';

import {
  deviceStatusLabel,
  deviceStatusTone,
  type DeviceStatus,
  type DeviceStatusTone,
} from '../../../types/deviceStatus';
import { noir } from '../../../ui/theme';

interface NoirStatusPillProps {
  readonly status: DeviceStatus;
}

const TONE_STYLE: Record<DeviceStatusTone, { text: string; bg: string; dot: string }> = {
  good: { text: noir.mintSoft, bg: 'rgba(16,181,164,0.12)', dot: noir.mint },
  working: { text: noir.amberSoft, bg: 'rgba(245,165,36,0.12)', dot: noir.amber },
  attention: { text: noir.dangerSoft, bg: 'rgba(239,75,92,0.12)', dot: noir.danger },
  inactive: { text: noir.ink3, bg: 'rgba(255,255,255,0.04)', dot: '#4a5260' },
};

export function NoirStatusPill({ status }: NoirStatusPillProps) {
  const tone = TONE_STYLE[deviceStatusTone(status)];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]} accessibilityLabel={deviceStatusLabel(status)}>
      <View style={[styles.dot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.label, { color: tone.text }]}>{deviceStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12.5, fontWeight: '600' },
});
