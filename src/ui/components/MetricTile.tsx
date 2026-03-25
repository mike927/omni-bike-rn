import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { palette } from '../theme';

interface MetricTileProps {
  label: string;
  value: string;
  style?: ViewStyle;
}

export function MetricTile({ label, value, style }: MetricTileProps) {
  return (
    <View style={[styles.tile, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 140,
    flex: 1,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  value: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
  },
});
