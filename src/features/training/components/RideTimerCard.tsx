import { StyleSheet, Text, View } from 'react-native';

import { noir } from '../../../ui/theme';

export interface RideTimerCardProps {
  readonly phaseLabel: string;
  readonly timerText: string;
  /** Recording indicator dot (not a device status) — shown while a ride is live. */
  readonly live?: boolean;
}

export function RideTimerCard({ phaseLabel, timerText, live = false }: RideTimerCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        {live ? <View style={styles.liveDot} /> : null}
        <Text style={styles.label}>Elapsed · {phaseLabel}</Text>
      </View>
      <Text style={styles.timer}>{timerText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: noir.mint },
  label: {
    color: noir.ink3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timer: {
    marginTop: 6,
    color: noir.ink,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
});
