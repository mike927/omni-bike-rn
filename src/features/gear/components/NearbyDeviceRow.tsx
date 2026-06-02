import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GearType } from '../../../types/gear';
import { noir } from '../../../ui/theme';
import { BikeGlyph } from './BikeGlyph';
import { HrGlyph } from './HrGlyph';

interface NearbyDeviceRowProps {
  readonly name: string | null;
  readonly deviceId: string;
  readonly target: GearType;
  readonly onSelect: () => void;
}

export function NearbyDeviceRow({ name, deviceId, target, onSelect }: NearbyDeviceRowProps) {
  const Glyph = target === 'hr' ? HrGlyph : BikeGlyph;
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Glyph color={noir.ink3} testID={target === 'hr' ? 'hr-glyph' : 'bike-glyph'} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {name ?? 'Unknown Device'}
        </Text>
        <Text style={styles.id} numberOfLines={1}>
          ID · {deviceId}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onSelect}
        style={({ pressed }) => [styles.selectBtn, pressed && styles.pressed]}>
        <Text style={styles.selectLabel}>Select</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    padding: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#1d222b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: noir.ink },
  id: { fontSize: 12.5, color: noir.ink3, marginTop: 2 },
  selectBtn: {
    backgroundColor: noir.card3,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: '#232c3d' },
  selectLabel: { fontSize: 13, fontWeight: '700', color: noir.indigoSoft },
});
