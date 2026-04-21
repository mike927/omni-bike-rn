import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { formatDistanceKm, formatDuration, formatSessionDate } from '../../../ui/formatters';
import { palette } from '../../../ui/theme';
import { ProviderStatusIcons } from './ProviderStatusIcons';
import type { WorkoutHistoryListItemProps } from './WorkoutHistoryListItem.types';

const TRASH_ICON_SIZE = 20;

export function WorkoutHistoryListItem({
  session,
  uploadedProviderIds,
  onPress,
  onDelete,
}: Readonly<WorkoutHistoryListItemProps>) {
  const handleDeletePress = (event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    onDelete();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Workout on ${formatSessionDate(session.startedAtMs)}`}>
      <View style={styles.leftColumn}>
        <Text style={styles.dateText}>{formatSessionDate(session.startedAtMs)}</Text>
        <Text style={styles.metricsText}>
          {formatDistanceKm(session.totalDistanceMeters)} • {formatDuration(session.elapsedSeconds)} •{' '}
          {session.totalCaloriesKcal.toFixed(0)} kcal
        </Text>
      </View>
      <View style={styles.rightColumn}>
        <ProviderStatusIcons uploadedProviderIds={uploadedProviderIds} />
        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
          onPress={handleDeletePress}
          accessibilityRole="button"
          accessibilityLabel="Delete workout"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash-outline" size={TRASH_ICON_SIZE} color={palette.danger} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  containerPressed: {
    opacity: 0.7,
  },
  leftColumn: {
    flex: 1,
    gap: 4,
  },
  dateText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  metricsText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  rightColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonPressed: {
    opacity: 0.5,
  },
});
