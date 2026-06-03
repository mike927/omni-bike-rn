import { StyleSheet, Text, View } from 'react-native';

import { noir } from '../../../ui/theme';

export interface SecondaryMetricItem {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}

export interface SecondaryMetricsRowProps {
  readonly items: readonly SecondaryMetricItem[];
}

export function SecondaryMetricsRow({ items }: SecondaryMetricsRowProps) {
  return (
    <View style={styles.row}>
      {items.map((m) => (
        <View key={m.key} style={styles.cell}>
          <Text style={styles.label}>{m.label}</Text>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {m.value}
          </Text>
          <Text style={styles.unit}>{m.unit}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  label: {
    color: noir.ink3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 5,
    color: noir.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  unit: { marginTop: 1, color: noir.ink2, fontSize: 10.5, fontWeight: '600' },
});
