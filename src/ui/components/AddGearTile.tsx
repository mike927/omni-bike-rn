import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { palette } from '../theme';

export interface AddGearTileProps {
  /** CTA copy, e.g. "Set Up Smart Bike". */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

/**
 * Dashed, full-width "add" tile for an empty gear slot — a clear tap-to-add
 * affordance, visually distinct from populated {@link GearTile} rows.
 */
export function AddGearTile({ label, onPress, testID }: AddGearTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}>
      <Ionicons name="add" size={18} color={palette.primary} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
  },
  label: { color: palette.primary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
