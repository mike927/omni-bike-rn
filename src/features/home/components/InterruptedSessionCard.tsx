import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration, formatSessionDate } from '../../../ui/formatters';
import { palette } from '../../../ui/theme';
import type { InterruptedSessionCardProps } from './InterruptedSessionCard.types';

export function InterruptedSessionCard({ session, onResume, onDiscard }: InterruptedSessionCardProps) {
  return (
    <SectionCard
      title="Interrupted Session"
      description={`Last saved workout from ${formatSessionDate(session.startedAtMs)}.`}>
      <Text style={styles.summaryText}>{formatDuration(session.elapsedSeconds)} elapsed</Text>
      <Text style={styles.detailText}>
        {formatDistanceKm(session.totalDistanceMeters)} • {session.totalCaloriesKcal.toFixed(1)} kcal
      </Text>
      <Text style={styles.helperText}>Resume in Paused to review the recovered state before the ride continues.</Text>
      <View style={styles.actionRow}>
        <ActionButton label="Resume" onPress={onResume} />
        <ActionButton label="Discard" onPress={onDiscard} variant="danger" />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  summaryText: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  detailText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
