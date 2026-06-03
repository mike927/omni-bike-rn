import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { noir } from '../../../ui/theme';

export interface FeatureMetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  /** Mint-tinted treatment (used for the Heart Rate card). */
  readonly accent?: boolean;
  /** Bottom content: a sparkline (Power) or a source line (Heart Rate). */
  readonly children?: ReactNode;
}

export function FeatureMetricCard({ label, value, unit, accent = false, children }: FeatureMetricCardProps) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, accent && styles.valueAccent]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <View style={styles.foot}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 138,
    justifyContent: 'space-between',
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 22,
    padding: 17,
  },
  cardAccent: {
    backgroundColor: 'rgba(16,181,164,0.08)',
    borderColor: 'rgba(16,181,164,0.28)',
  },
  label: {
    color: noir.ink3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  value: {
    flexShrink: 1,
    color: noir.ink,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  valueAccent: { color: noir.mintSoft },
  unit: { color: noir.ink2, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  foot: { minHeight: 30, justifyContent: 'flex-end' },
});
