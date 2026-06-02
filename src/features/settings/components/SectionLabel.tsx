import { StyleSheet, Text, View } from 'react-native';
import { noir } from '../../../ui/theme';

export function SectionLabel({ title }: { readonly title: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

export function Eyebrow({ children }: { readonly children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  title: { color: noir.ink, fontSize: 14, fontWeight: '700' },
  eyebrow: {
    color: noir.ink3,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
});
