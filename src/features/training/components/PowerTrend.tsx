import { StyleSheet, View } from 'react-native';

import { noir } from '../../../ui/theme';

const BARS = 12;
/** Floor for the scale so a low-power ride still renders sane bar heights. */
const SCALE_FLOOR = 80;

export interface PowerTrendProps {
  readonly samples: readonly number[];
}

/** Right-aligned mini bar chart of the most recent power readings. */
export function PowerTrend({ samples }: PowerTrendProps) {
  const recent = samples.slice(-BARS);
  const max = Math.max(SCALE_FLOOR, ...recent);
  const offset = BARS - recent.length;

  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: BARS }).map((_, i) => {
        const j = i - offset;
        const value = j >= 0 ? (recent[j] ?? null) : null;
        const isLast = j === recent.length - 1 && value !== null;
        const heightPct = value === null ? 12 : Math.max(12, (value / max) * 100);
        return (
          <View
            key={i}
            style={[styles.bar, { height: `${heightPct}%`, opacity: value === null ? 0.18 : isLast ? 0.95 : 0.5 }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 30 },
  bar: { flex: 1, backgroundColor: noir.indigoSoft, borderRadius: 2, minHeight: 3 },
});
