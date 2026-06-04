import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { noirGradient } from '../../../ui/theme';
import type { SummaryHero } from '../screens/summaryViewModel';

export function RideCompleteHero({ hero }: { readonly hero: SummaryHero }) {
  return (
    <LinearGradient colors={noirGradient.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.badge}>
        <Ionicons name="checkmark" size={26} color="#ffffff" />
      </View>
      <Text style={styles.eyebrow}>RIDE COMPLETE</Text>
      <View style={styles.figureRow}>
        <Text style={styles.figure} numberOfLines={1} adjustsFontSizeToFit>
          {hero.distance}
        </Text>
        <Text style={styles.figureUnit}>{hero.distanceUnit}</Text>
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{hero.dateLabel}</Text>
        <View style={styles.dot} />
        <Text style={styles.pillText}>{hero.movingLabel}</Text>
        <View style={styles.dot} />
        <Text style={styles.pillText}>{hero.caloriesLabel}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center' },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  eyebrow: { marginTop: 10, color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '700', letterSpacing: 1.6 },
  figureRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 5 },
  figure: { color: '#ffffff', fontSize: 50, fontWeight: '800', letterSpacing: -2.4, fontVariant: ['tabular-nums'] },
  figureUnit: { color: 'rgba(255,255,255,0.85)', fontSize: 21, fontWeight: '700', marginBottom: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  pillText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.55)' },
});
