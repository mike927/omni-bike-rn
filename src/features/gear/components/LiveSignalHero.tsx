import { StyleSheet, Text, View } from 'react-native';

import type { BikeMetrics } from '../../../services/ble/BikeAdapter';
import type { GearType } from '../../../types/gear';
import { noir } from '../../../ui/theme';
import { NoirStatusPill } from './NoirStatusPill';

interface LiveSignalHeroProps {
  readonly target: GearType;
  readonly confirmed: boolean;
  readonly bikeMetrics: BikeMetrics | null;
  readonly hrBpm: number | null;
}

const PLACEHOLDER = '—';

function fmt(value: number | undefined, digits: number): string {
  if (value === undefined || Number.isNaN(value)) return PLACEHOLDER;
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
}

export function LiveSignalHero({ target, confirmed, bikeMetrics, hrBpm }: LiveSignalHeroProps) {
  const live = confirmed ? bikeMetrics : null;
  const hr = confirmed ? hrBpm : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>LIVE DATA</Text>
        {confirmed ? <NoirStatusPill status="ready" /> : <Text style={styles.waiting}>Waiting for signal…</Text>}
      </View>

      {target === 'bike' ? (
        <View style={styles.grid}>
          <Cell label="Power" value={live ? fmt(live.power, 0) : PLACEHOLDER} unit="W" hero />
          <Cell label="Cadence" value={live ? fmt(live.cadence, 0) : PLACEHOLDER} unit="rpm" />
          <Cell label="Speed" value={live ? fmt(live.speed, 1) : PLACEHOLDER} unit="km/h" />
          <Cell
            label="Distance"
            value={live?.distance === undefined ? PLACEHOLDER : fmt(live.distance / 1000, 1)}
            unit="km"
          />
        </View>
      ) : (
        <View style={styles.hrWrap}>
          <Text style={styles.hrValue}>{hr === null ? PLACEHOLDER : String(hr)}</Text>
          <Text style={styles.hrUnit}>BPM</Text>
        </View>
      )}

      {confirmed ? null : (
        <Text style={styles.hint}>
          Start pedalling — numbers appear the moment the {target === 'bike' ? 'bike' : 'sensor'} streams.
        </Text>
      )}
    </View>
  );
}

interface CellProps {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly hero?: boolean;
}

function Cell({ label, value, unit, hero }: CellProps) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label.toUpperCase()}</Text>
      <View style={styles.cellValueRow}>
        <Text style={[styles.cellValue, hero && styles.cellValueHero]}>{value}</Text>
        <Text style={styles.cellUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: noir.card, borderWidth: 1, borderColor: noir.hairline, borderRadius: 26, padding: 22 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, color: noir.ink3 },
  waiting: { fontSize: 13, fontWeight: '600', color: noir.amberSoft },
  grid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 7 },
  cellLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: noir.ink3 },
  cellValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  cellValue: { fontSize: 34, fontWeight: '800', letterSpacing: -1, color: noir.ink },
  cellValueHero: { color: noir.mintSoft, fontSize: 40 },
  cellUnit: { fontSize: 13, fontWeight: '600', color: noir.ink3, marginLeft: 4, marginBottom: 6 },
  hrWrap: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-end' },
  hrValue: { fontSize: 56, fontWeight: '800', letterSpacing: -2, color: noir.mintSoft },
  hrUnit: { fontSize: 15, fontWeight: '600', color: noir.ink3, marginLeft: 8, marginBottom: 8 },
  hint: { marginTop: 18, fontSize: 13.5, lineHeight: 19, color: noir.ink2 },
});
