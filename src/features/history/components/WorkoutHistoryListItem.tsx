import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCompactDuration, formatDistanceKmShort, formatHistoryDate } from '../../../ui/formatters';
import { noir } from '../../../ui/theme';
import { ProviderStatusIcons } from './ProviderStatusIcons';
import type { WorkoutHistoryListItemProps } from './WorkoutHistoryListItem.types';

// Exposes deletion to assistive tech (VoiceOver "Actions" rotor) since the row has no visible
// trash button — long press is a pointer-only gesture and isn't reachable via a screen reader.
const DELETE_ACCESSIBILITY_ACTIONS = [{ name: 'delete', label: 'Delete workout' }];

function formatMetricsLine(session: WorkoutHistoryListItemProps['session']): string {
  const distance = formatDistanceKmShort(session.totalDistanceMeters);
  const duration = formatCompactDuration(session.elapsedSeconds);
  const energy = `${Math.round(session.totalCaloriesKcal)} kcal`;
  return `${distance} · ${duration} · ${energy}`;
}

export function WorkoutHistoryListItem({
  session,
  uploadedProviderIds,
  onPress,
  onDelete,
}: Readonly<WorkoutHistoryListItemProps>) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`Workout on ${formatHistoryDate(session.startedAtMs)}`}
      accessibilityHint="Opens the ride summary. Long press, or use the Delete action, to remove it."
      accessibilityActions={DELETE_ACCESSIBILITY_ACTIONS}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') {
          onDelete();
        }
      }}>
      <View style={styles.main}>
        <Text style={styles.date}>{formatHistoryDate(session.startedAtMs)}</Text>
        <Text style={styles.metrics}>{formatMetricsLine(session)}</Text>
      </View>
      <View style={styles.providers}>
        <ProviderStatusIcons uploadedProviderIds={uploadedProviderIds} />
        <Ionicons name="chevron-forward" size={18} color={noir.ink3} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: '#2a323f',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  date: {
    color: noir.ink,
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  metrics: {
    color: noir.ink3,
    fontSize: 13,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  providers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
