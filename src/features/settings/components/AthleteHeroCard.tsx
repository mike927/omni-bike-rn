import { StyleSheet, Text, View } from 'react-native';

import { noir, noirPillTones } from '../../../ui/theme';
import type { AccuracyTone, ProfileViewModel } from '../screens/userProfileViewModel';

interface AccuracyToneColors {
  readonly dot: string;
  readonly fg: string;
  readonly bg: string;
}

const TONE_COLORS: Record<AccuracyTone, AccuracyToneColors> = {
  good: { dot: noir.mint, fg: noir.mintSoft, bg: 'rgba(16,181,164,0.12)' },
  working: { dot: noir.amber, fg: noir.amberSoft, bg: 'rgba(245,165,36,0.12)' },
  inactive: noirPillTones.inactive,
};

export function AthleteHeroCard({ vm }: Readonly<{ vm: ProfileViewModel }>) {
  const tone = TONE_COLORS[vm.accuracy.tone];
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>ATHLETE · BODY PROFILE</Text>
          <Text style={styles.title}>Body Profile</Text>
        </View>
        <View
          style={[styles.pill, { backgroundColor: tone.bg }]}
          accessibilityRole="text"
          accessibilityLabel={`Calorie accuracy: ${vm.accuracy.label}`}>
          <View style={[styles.pillDot, { backgroundColor: tone.dot }]} />
          <Text style={[styles.pillText, { color: tone.fg }]}>{vm.accuracy.label}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {vm.stats.map((stat) => (
          <View key={stat.key} style={styles.statCell}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {stat.value}
              </Text>
              {stat.unit ? <Text style={styles.statUnit}>{stat.unit}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.caption}>{vm.accuracy.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: { flexShrink: 1, gap: 4 },
  eyebrow: { color: noir.ink3, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: noir.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  pillDot: { width: 7, height: 7, borderRadius: 3.5 },
  pillText: { fontSize: 12.5, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCell: { width: '47%', flexGrow: 1, gap: 6 },
  statLabel: { color: noir.ink3, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  statValue: { color: noir.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  statUnit: { color: noir.ink3, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  caption: { color: noir.ink2, fontSize: 13, fontWeight: '500', lineHeight: 19 },
});
