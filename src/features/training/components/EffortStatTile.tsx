import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { noir } from '../../../ui/theme';
import type { EffortAccent } from '../screens/summaryViewModel';

export interface EffortStatTileProps {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly peakLabel: string | null;
  readonly accent: EffortAccent;
}

const ACCENT_ICON = { power: 'flash', hr: 'heart' } as const;

export function EffortStatTile({ label, value, unit, peakLabel, accent }: EffortStatTileProps) {
  const iconColor = accent === 'hr' ? noir.mintSoft : noir.indigoSoft;
  return (
    <View style={styles.tile}>
      <View style={styles.head}>
        {accent ? <Ionicons name={ACCENT_ICON[accent]} size={13} color={iconColor} /> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      {peakLabel ? (
        <Text style={styles.peak}>
          Max <Text style={styles.peakValue}>{peakLabel}</Text>
        </Text>
      ) : (
        <Text style={styles.peakPlaceholder}> </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { color: noir.ink3, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 7 },
  value: { color: noir.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  unit: { color: noir.ink3, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  peak: { marginTop: 7, color: noir.ink2, fontSize: 11.5, fontWeight: '600' },
  peakValue: { color: noir.mintSoft, fontWeight: '700' },
  peakPlaceholder: { marginTop: 7, fontSize: 11.5 },
});
