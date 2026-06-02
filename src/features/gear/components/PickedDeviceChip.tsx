import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DeviceStatus } from '../../../types/deviceStatus';
import type { GearType } from '../../../types/gear';
import { noir } from '../../../ui/theme';
import { BikeGlyph } from './BikeGlyph';
import { HrGlyph } from './HrGlyph';
import { NoirStatusPill } from './NoirStatusPill';

interface PickedDeviceChipProps {
  readonly name: string;
  readonly status: DeviceStatus;
  readonly target: GearType;
  readonly onSwap: () => void;
  readonly errored?: boolean;
}

export function PickedDeviceChip({ name, status, target, onSwap, errored }: PickedDeviceChipProps) {
  const Glyph = target === 'hr' ? HrGlyph : BikeGlyph;
  return (
    <View style={[styles.chip, errored ? styles.chipError : styles.chipOk]}>
      <View style={styles.icon}>
        <Glyph
          color={errored ? noir.dangerSoft : noir.indigoSoft}
          testID={target === 'hr' ? 'hr-glyph' : 'bike-glyph'}
        />
      </View>
      <View style={styles.meta}>
        <Text style={[styles.name, errored && styles.nameError]} numberOfLines={1}>
          {name}
        </Text>
        {errored ? <Text style={styles.errorSub}>Can’t be used</Text> : null}
      </View>
      {errored ? null : <NoirStatusPill status={status} />}
      <Pressable accessibilityRole="button" onPress={onSwap} hitSlop={8} style={styles.swapHit}>
        <Text style={styles.swap}>Swap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 20, padding: 14 },
  chipOk: {
    backgroundColor: noir.card,
    borderColor: 'rgba(46,61,255,0.4)',
    borderLeftWidth: 4,
    borderLeftColor: noir.indigo,
  },
  chipError: {
    backgroundColor: noir.card,
    borderColor: 'rgba(239,75,92,0.4)',
    borderLeftWidth: 4,
    borderLeftColor: noir.danger,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: noir.card3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: noir.indigoSoft },
  nameError: { color: noir.dangerSoft },
  errorSub: { fontSize: 12.5, color: noir.ink3, marginTop: 2 },
  swapHit: { paddingHorizontal: 4, paddingVertical: 4 },
  swap: { fontSize: 13, fontWeight: '700', color: noir.indigoSoft },
});
