import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../../../ui/theme';

export interface HeartRateSourceTileProps {
  readonly name: string;
  readonly state: string | null;
}

export function HeartRateSourceTile({ name, state }: HeartRateSourceTileProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Heart Rate Source</Text>
      <Text style={styles.value}>{state === null ? name : `${name} · ${state}`}</Text>
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
  value: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
