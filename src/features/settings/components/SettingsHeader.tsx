import { StyleSheet, Text, View } from 'react-native';
import { noir } from '../../../ui/theme';

export interface SettingsHeaderProps {
  readonly title: string;
  readonly subtitle: string;
}

export function SettingsHeader({ title, subtitle }: SettingsHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4, gap: 9 },
  title: { color: noir.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.7, lineHeight: 32 },
  subtitle: { color: noir.ink2, fontSize: 14.5, lineHeight: 20, maxWidth: 320 },
});
