import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BikeGlyph } from '../../gear/components/BikeGlyph';
import { noir } from '../../../ui/theme';

interface ProviderBikeRowProps {
  readonly name: string;
  readonly meta: string;
  readonly selected: boolean;
  readonly isMatch: boolean;
  readonly onPress: () => void;
}

export function ProviderBikeRow({ name, meta, selected, isMatch, onPress }: ProviderBikeRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}>
      {selected ? <View style={styles.accentBar} /> : null}
      <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
        <BikeGlyph color={selected ? noir.indigoSoft : noir.ink3} size={22} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {isMatch ? (
        <View style={styles.matchPill}>
          <Text style={styles.matchPillLabel}>Possible match</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: noir.hairline,
    backgroundColor: noir.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  rowSelected: {
    borderColor: noir.indigo,
    backgroundColor: 'rgba(46,61,255,0.10)',
    paddingLeft: 18,
  },
  rowPressed: { opacity: 0.82 },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: noir.indigo,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(86,99,255,0.10)',
  },
  iconBoxSelected: {
    backgroundColor: 'rgba(86,99,255,0.18)',
  },
  body: { flex: 1, gap: 3 },
  name: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  nameSelected: { color: noir.indigoText },
  meta: { color: noir.ink3, fontSize: 12.5, lineHeight: 17 },
  matchPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(16,181,164,0.12)',
  },
  matchPillLabel: { color: noir.mintSoft, fontSize: 11.5, fontWeight: '700' },
});
