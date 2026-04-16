import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import type { PersistedTrainingSession } from '../../../types/sessionPersistence';
import { formatDistanceKm, formatDuration, formatSessionDate } from '../../../ui/formatters';
import { palette } from '../../../ui/theme';

interface WorkoutHistoryListItemProps {
  session: PersistedTrainingSession;
  onPress: () => void;
  onDelete: () => void;
}

export function WorkoutHistoryListItem({ session, onPress, onDelete }: Readonly<WorkoutHistoryListItemProps>) {
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
      <Pressable
        style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
        onPress={handleDeletePress}
        accessibilityRole="button"
        accessibilityLabel="Delete workout"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </Pressable>
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
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: palette.surfaceMuted,
  },
  deleteButtonPressed: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
