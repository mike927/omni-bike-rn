import { StyleSheet, Text, View } from 'react-native';

import { noir } from '../../../ui/theme';

export interface HomeHeaderProps {
  readonly greeting: string;
  readonly subline: string;
  /** Injectable for deterministic tests; defaults to now. */
  readonly now?: Date;
}

function formatKickerDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export function HomeHeader({ greeting, subline, now }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.kicker}>
        <Text style={styles.app}>Omni Bike</Text>
        {` · ${formatKickerDate(now ?? new Date())}`}
      </Text>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.subline}>{subline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4 },
  kicker: { color: noir.ink3, fontSize: 13, fontWeight: '600', marginBottom: 7 },
  app: { color: noir.indigoSoft, fontWeight: '700' },
  greeting: { color: noir.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 },
  subline: { color: noir.ink2, fontSize: 14.5, lineHeight: 20, marginTop: 9, maxWidth: 320 },
});
