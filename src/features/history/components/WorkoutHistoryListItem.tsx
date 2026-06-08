import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SwipeableRow } from '../../../ui/components/SwipeableRow';
import { formatCompactDuration, formatDistanceKmShort, formatHistoryDate } from '../../../ui/formatters';
import { noir } from '../../../ui/theme';
import { ProviderStatusIcons } from './ProviderStatusIcons';
import type { WorkoutHistoryListItemProps } from './WorkoutHistoryListItem.types';

// Keeps deletion reachable by assistive tech (VoiceOver "Actions" rotor) in addition to the
// visible swipe button — swipe and long press are pointer-only gestures.
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
    <SwipeableRow
      borderRadius={16}
      showHandle={false}
      actions={[{ key: 'delete', label: 'Delete', icon: 'trash-outline', tone: 'danger', onPress: onDelete }]}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={onPress}
        onLongPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Workout on ${formatHistoryDate(session.startedAtMs)}`}
        accessibilityHint="Opens the ride summary. Swipe left, long press, or use the Delete action to remove it."
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
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowPressed: {
    transform: [{ scale: 0.99 }],
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
