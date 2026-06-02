import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDistanceKm, formatDuration, formatSessionDate } from '../../../ui/formatters';
import { noir } from '../../../ui/theme';
import type { InterruptedSessionCardProps } from './InterruptedSessionCard.types';

export function InterruptedSessionCard({ session, onResume, onDiscard }: Readonly<InterruptedSessionCardProps>) {
  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.iconBox}>
          <Ionicons name="time-outline" size={18} color="#f5a524" />
        </View>
        <View style={styles.headText}>
          <Text style={styles.title}>Resume interrupted ride</Text>
          <Text style={styles.sub}>
            {formatDuration(session.elapsedSeconds)} · saved {formatSessionDate(session.startedAtMs)}
          </Text>
        </View>
      </View>
      <Text style={styles.detail}>
        {formatDistanceKm(session.totalDistanceMeters)} · {session.totalCaloriesKcal.toFixed(1)} kcal
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Resume"
          onPress={onResume}
          style={({ pressed }) => [styles.btn, styles.resume, pressed && styles.pressed]}>
          <Text style={styles.resumeLabel}>Resume</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard"
          onPress={onDiscard}
          style={({ pressed }) => [styles.btn, styles.discard, pressed && styles.pressed]}>
          <Text style={styles.discardLabel}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(245,165,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.30)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(245,165,36,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, minWidth: 0 },
  title: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  sub: { color: noir.ink2, fontSize: 12.5, marginTop: 1 },
  detail: { color: noir.ink2, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resume: { backgroundColor: noir.indigo },
  resumeLabel: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  discard: { backgroundColor: 'rgba(239,75,92,0.12)', borderWidth: 1, borderColor: 'rgba(239,75,92,0.3)' },
  discardLabel: { color: '#f4818d', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
