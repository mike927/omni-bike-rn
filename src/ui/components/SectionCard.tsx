import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { palette } from '../theme';

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  onPress?: () => void;
}

export function SectionCard({ title, description, children, onPress }: Readonly<SectionCardProps>) {
  const inner = (
    <>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {onPress ? <Ionicons name="settings-outline" size={20} color={palette.textMuted} /> : null}
        </View>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={styles.content}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.card}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 18,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
  },
  description: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    gap: 14,
  },
});
