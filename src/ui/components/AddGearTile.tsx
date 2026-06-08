import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { noir, palette } from '../theme';

export interface AddGearTileProps {
  /** CTA copy, e.g. "Set Up Smart Bike". */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
  readonly scheme?: 'light' | 'noir';
}

/**
 * Dashed, full-width "add" tile for an empty gear slot — a clear tap-to-add
 * affordance, visually distinct from populated {@link GearTile} rows.
 */
export function AddGearTile({ label, onPress, testID, scheme = 'light' }: AddGearTileProps) {
  const isNoir = scheme === 'noir';
  const iconColor = isNoir ? noir.indigoSoft : palette.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.tile, isNoir ? styles.tileNoir : null, pressed ? styles.pressed : null]}>
      <Ionicons name="add" size={18} color={iconColor} />
      <Text style={[styles.label, isNoir ? styles.labelNoir : null]}>{label}</Text>
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
  tileNoir: {
    borderColor: noir.hairline,
    backgroundColor: 'rgba(46,61,255,0.04)',
  },
  label: { color: palette.primary, fontSize: 15, fontWeight: '700' },
  labelNoir: { color: noir.indigoText },
  pressed: { opacity: 0.7 },
});
