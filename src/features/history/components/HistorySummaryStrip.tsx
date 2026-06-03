import { StyleSheet, Text, View } from 'react-native';

import { formatCompactDuration } from '../../../ui/formatters';
import { noir } from '../../../ui/theme';
import type { HistorySummaryStripProps } from './HistorySummaryStrip.types';

interface SummaryCell {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
}

/** Monthly snapshot strip (mockup `screen-06-history`): rides · distance · time, divided into cells. */
export function HistorySummaryStrip({ summary }: Readonly<HistorySummaryStripProps>) {
  const cells: readonly SummaryCell[] = [
    { label: 'This Month', value: String(summary.rideCount), unit: 'rides' },
    { label: 'Distance', value: String(Math.round(summary.totalDistanceMeters / 1000)), unit: 'km' },
    { label: 'Time', value: formatCompactDuration(summary.totalDurationSeconds) },
  ];

  return (
    <View style={styles.strip}>
      {cells.map((cell, index) => (
        <View key={cell.label} style={[styles.cell, index > 0 && styles.cellDivided]}>
          <Text style={styles.label}>{cell.label}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{cell.value}</Text>
            {cell.unit ? <Text style={styles.unit}>{cell.unit}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  cellDivided: {
    borderLeftWidth: 1,
    borderLeftColor: noir.hairline,
  },
  label: {
    color: noir.ink3,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 5,
  },
  value: {
    color: noir.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: noir.ink3,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
});
