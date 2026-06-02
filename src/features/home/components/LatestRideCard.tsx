import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDistanceKm, formatDuration } from '../../../ui/formatters';
import { noir } from '../../../ui/theme';
import type { PersistedTrainingSession } from '../../../types/sessionPersistence';

export interface LatestRideCardProps {
  readonly workout: PersistedTrainingSession | null;
  readonly timestampMs: number | null;
  readonly onViewSummary: () => void;
}

function formatRideDate(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(timestampMs),
  );
}

export function LatestRideCard({ workout, timestampMs, onViewSummary }: LatestRideCardProps) {
  if (!workout || timestampMs === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyTitle}>No rides yet</Text>
        <Text style={styles.emptyBody}>Complete a ride and your recap will show up here.</Text>
      </View>
    );
  }

  const distanceKm = formatDistanceKm(workout.totalDistanceMeters).replace(' km', '');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View>
          <Text style={styles.tag}>LATEST RIDE</Text>
          <Text style={styles.date}>{formatRideDate(timestampMs)}</Text>
        </View>
        <View style={styles.pin}>
          <Ionicons name="time-outline" size={18} color={noir.indigoSoft} />
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.value}>{formatDuration(workout.elapsedSeconds)}</Text>
          <Text style={styles.key}>DURATION</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.value}>
            {distanceKm}
            <Text style={styles.unit}> km</Text>
          </Text>
          <Text style={styles.key}>DISTANCE</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.value}>
            {Math.round(workout.totalCaloriesKcal)}
            <Text style={styles.unit}> kcal</Text>
          </Text>
          <Text style={styles.key}>ENERGY</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View summary"
        onPress={onViewSummary}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
        <Text style={styles.ctaLabel}>View summary</Text>
        <Ionicons name="chevron-forward" size={16} color={noir.indigoSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 26,
    padding: 18,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  tag: { color: noir.indigoSoft, fontSize: 11.5, fontWeight: '600', letterSpacing: 0.4 },
  date: { color: noir.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginTop: 4 },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: noir.card3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { flex: 1 },
  value: { color: noir.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.6 },
  unit: { color: noir.ink3, fontSize: 11.5, fontWeight: '600' },
  key: { color: noir.ink3, fontSize: 10.5, fontWeight: '500', letterSpacing: 0.3, marginTop: 5 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    borderWidth: 1,
    borderColor: noir.hairline,
    backgroundColor: noir.cardAlt,
    borderRadius: 14,
    paddingVertical: 12,
  },
  ctaPressed: { backgroundColor: '#232c3d' },
  ctaLabel: { color: noir.indigoSoft, fontSize: 14, fontWeight: '700' },
  emptyTitle: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  emptyBody: { color: noir.ink2, fontSize: 13.5, lineHeight: 19, marginTop: 6 },
});
